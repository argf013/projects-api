import { Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { neon } from '@neondatabase/serverless';
import { v2 as cloudinary } from 'cloudinary';

const sql = neon(process.env.DATABASE_URL!);

interface Resource {
  asset_id: string;
  public_id: string;
  format: string;
  version: number;
  resource_type: string;
  type: string;
  created_at: string;
  bytes: number;
  width: number;
  height: number;
  asset_folder: string;
  display_name: string;
  url: string;
  secure_url: string;
}

const getAllFiles = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const files = await sql`
      SELECT * FROM files
      ORDER BY "createdAt" DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;

    const transformedFiles = files.map((file: Record<string, any>) => ({
      id: file.id,
      filename: file.filename,
      url: file.url,
      createdAt: file.createdAt,
    }));

    const totalCount = await sql`SELECT COUNT(*) as count FROM files`;
    const total = totalCount[0].count;

    res.json({
      code: 200,
      message: 'Files retrieved successfully',
      data: transformedFiles,
      pagination: {
        page,
        limit,
        total: parseInt(total),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({
      code: 500,
      message: 'Internal Server Error',
      data: null,
    });
  }
};

const getAllThumbnails = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'project-thumbnails/',
      max_results: 100,
    });

    const thumbnails = result.resources.map((resource: Resource) => ({
      public_id: resource.public_id,
      filename:
        resource.public_id.replace('project-thumbnails/', '') +
        '.' +
        resource.format,
      url: resource.secure_url,
      format: resource.format,
      created_at: resource.created_at,
      bytes: resource.bytes,
      width: resource.width,
      height: resource.height,
    }));

    res.json({
      code: 200,
      total: parseInt(thumbnails.length),
      message: 'Thumbnails retrieved successfully',
      data: thumbnails,
    });
  } catch (error) {
    console.error('Error fetching thumbnails from Cloudinary:', error);
    res.status(500).json({
      code: 500,
      message: 'Internal Server Error',
      data: null,
    });
  }
};

const uploadThumbnail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { file, filename } = req.body;

    if (!file || !filename) {
      res.status(400).json({
        code: 400,
        message: 'File and filename are required',
        data: null,
      });
    }

    const uploadResult = await cloudinary.uploader.upload(file, {
      folder: 'project-thumbnails',
      public_id: `${nanoid()}_${filename.split('.')[0]}`,
      resource_type: 'image',
      transformation: [
        { width: 800, height: 600, crop: 'limit' },
        { quality: 'auto' },
      ],
    });

    const fileId = nanoid();
    const now = new Date().toISOString();

    await sql`INSERT INTO files (id, filename, url, "createdAt") VALUES (${fileId}, ${filename}, ${uploadResult.secure_url}, ${now})`;

    res.json({
      code: 200,
      message: 'Thumbnail uploaded successfully',
      data: {
        id: uploadResult.public_id,
        filename,
        url: uploadResult.secure_url,
      },
    });
  } catch (error) {
    console.error('Error uploading thumbnail:', error);
    res
      .status(500)
      .json({ code: 500, message: 'Internal Server Error', data: null });
  }
}

export { getAllFiles, getAllThumbnails, uploadThumbnail };
