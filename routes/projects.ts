import { Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { neon } from '@neondatabase/serverless';
import { v2 as cloudinary } from 'cloudinary';

interface Thumbnail {
  url: string;
  filename: string | null;
}

interface Project {
  id: string;
  name: string;
  shortDesc: string;
  desc: string;
  thumbnail: Thumbnail;
  createdAt: string;
  updatedAt: string;
}

const sql = neon(process.env.DATABASE_URL!);

// helper function
const generateShortDesc = (desc: string, maxLength = 50): string => {
  if (desc.length <= maxLength) return desc;
  return desc.substring(0, maxLength).trim() + '...';
};

const isValidUrl = (url: string): boolean => {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

async function getAllProjects(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const projects = await sql`
      SELECT * FROM projects
      ORDER BY "createdAt" DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;

    const transformedProjects = projects.map((project: any) => {
      let thumbnailObj;
      try {
        thumbnailObj =
          typeof project.thumbnail === 'string'
            ? JSON.parse(project.thumbnail)
            : project.thumbnail;
      } catch {
        thumbnailObj = { url: project.thumbnail, filename: null };
      }
      return { ...project, thumbnail: thumbnailObj };
    });

    const totalCount = await sql`SELECT COUNT(*) as count FROM projects`;
    const total = totalCount[0].count;

    res.json({
      code: 200,
      message: 'Projects retrieved successfully',
      data: transformedProjects,
      pagination: {
        page,
        limit,
        total: parseInt(total),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res
      .status(500)
      .json({ code: 500, message: 'Internal Server Error', data: null });
  }
}

async function getProjectById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const project = await sql`SELECT * FROM projects WHERE id = ${id}`;

    if (project.length === 0) {
      res.status(404).json({
        code: 404,
        message: 'Project not found',
        data: null,
      });
    }

    let thumbnailObj;
    try {
      thumbnailObj =
        typeof project[0].thumbnail === 'string'
          ? JSON.parse(project[0].thumbnail)
          : project[0].thumbnail;
    } catch {
      thumbnailObj = { url: project[0].thumbnail, filename: null };
    }

    res.json({
      code: 200,
      message: 'Project retrieved successfully',
      data: { ...project[0], thumbnail: thumbnailObj },
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res
      .status(500)
      .json({ code: 500, message: 'Internal Server Error', data: null });
  }
}

async function createProject(req: Request, res: Response): Promise<void> {
  try {
    const { name, shortDesc, desc, thumbnail } = req.body;

    if (!name || !desc || !thumbnail) {
      res.status(400).json({
        code: 400,
        message: 'Name, description, and thumbnail are required',
        data: null,
      });
    }

    let thumbnailObj = null;
    let valid = false;

    if (typeof thumbnail === 'string') {
      // Check if filename exists in files
      const files =
        await sql`SELECT * FROM files WHERE filename = ${thumbnail} LIMIT 1`;
      if (files.length > 0) {
        thumbnailObj = {
          url: files[0].url,
          filename: files[0].filename,
        };
        valid = true;
      } else if (isValidUrl(thumbnail)) {
        thumbnailObj = { url: thumbnail, filename: null };
        valid = true;
      }
    } else if (
      typeof thumbnail === 'object' &&
      thumbnail.url &&
      thumbnail.filename
    ) {
      if (isValidUrl(thumbnail.url)) {
        thumbnailObj = thumbnail;
        valid = true;
      }
    }

    if (!valid) {
      res.status(400).json({
        code: 400,
        message:
          'Thumbnail must be a valid filename (uploaded file) or a valid URL',
        data: null,
      });
    }

    const id = nanoid();
    const finalShortDesc = shortDesc || generateShortDesc(desc);
    const now = new Date().toISOString();

    const project = await sql`
      INSERT INTO projects (id, name, "shortDesc", "desc", thumbnail, "createdAt", "updatedAt")
      VALUES (${id}, ${name}, ${finalShortDesc}, ${desc}, ${JSON.stringify(
      thumbnailObj
    )}, ${now}, ${now})
      RETURNING *
    `;

    const responseData: Project = {
      id: project[0].id,
      name: project[0].name,
      shortDesc: project[0].shortdesc,
      desc: project[0].desc,
      createdAt: project[0].createdAt,
      updatedAt: project[0].updatedat,
      thumbnail:
        typeof project[0].thumbnail === 'string'
          ? JSON.parse(project[0].thumbnail)
          : project[0].thumbnail,
    };

    res.status(201).json({
      code: 201,
      message: 'Project created successfully',
      data: responseData,
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({
      code: 500,
      message: 'Internal Server Error',
      data: null,
    });
  }
}

async function updateProject(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, shortDesc, desc, thumbnail } = req.body;

    // Check if project exists
    const existingProject = await sql`SELECT * FROM projects WHERE id = ${id}`;
    if (existingProject.length === 0) {
      res.status(404).json({
        code: 404,
        message: 'Project not found',
        data: null,
      });
    }

    const currentProject = existingProject[0];
    const updatedAt = new Date().toISOString();

    let thumbnailObj = null;
    let newThumbnail = thumbnail;
    let valid = false;

    if (thumbnail !== undefined) {
      if (typeof thumbnail === 'string') {
        const files =
          await sql`SELECT * FROM files WHERE filename = ${thumbnail} LIMIT 1`;
        if (files.length > 0) {
          thumbnailObj = {
            url: files[0].url,
            filename: files[0].filename,
          };
          valid = true;
        } else if (isValidUrl(thumbnail)) {
          thumbnailObj = { url: thumbnail, filename: null };
          valid = true;
        }
      } else if (
        typeof thumbnail === 'object' &&
        thumbnail.url &&
        thumbnail.filename
      ) {
        if (isValidUrl(thumbnail.url)) {
          thumbnailObj = thumbnail;
          valid = true;
        }
      }
      if (!valid) {
        res.status(400).json({
          code: 400,
          message:
            'Thumbnail must be a valid filename (uploaded file) or a valid URL',
          data: null,
        });
      }
      newThumbnail = JSON.stringify(thumbnailObj);
    }

    // If thumbnail is being updated, delete old thumbnail from Cloudinary
    if (thumbnail !== undefined && currentProject.thumbnail) {
      let oldThumbnailUrl = null;
      try {
        const oldThumb =
          typeof currentProject.thumbnail === 'string'
            ? JSON.parse(currentProject.thumbnail)
            : currentProject.thumbnail;
        oldThumbnailUrl = oldThumb.url || oldThumb;
      } catch {
        oldThumbnailUrl = currentProject.thumbnail;
      }
      if (
        oldThumbnailUrl &&
        typeof oldThumbnailUrl === 'string' &&
        oldThumbnailUrl.includes('cloudinary.com')
      ) {
        const matches = oldThumbnailUrl.match(/\/project-thumbnails\/([^\.]+)/);
        if (matches && matches[1]) {
          try {
            await cloudinary.uploader.destroy(
              `project-thumbnails/${matches[1]}`
            );
          } catch (cloudinaryError) {
            console.error(
              'Error deleting old thumbnail from Cloudinary:',
              cloudinaryError
            );
          }
        }
      }
    }

    let updatedProject;

    // Update logic: use newThumbnail if defined
    if (
      name !== undefined &&
      desc !== undefined &&
      shortDesc !== undefined &&
      newThumbnail !== undefined
    ) {
      updatedProject = await sql`
        UPDATE projects 
        SET name = ${name}, "shortDesc" = ${shortDesc}, "desc" = ${desc}, thumbnail = ${newThumbnail}, "updatedAt" = ${updatedAt}
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (
      name !== undefined &&
      desc !== undefined &&
      newThumbnail !== undefined
    ) {
      const finalShortDesc =
        shortDesc !== undefined ? shortDesc : generateShortDesc(desc);
      updatedProject = await sql`
        UPDATE projects 
        SET name = ${name}, "shortDesc" = ${finalShortDesc}, "desc" = ${desc}, thumbnail = ${newThumbnail}, "updatedAt" = ${updatedAt}
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (name !== undefined && desc !== undefined) {
      const finalShortDesc =
        shortDesc !== undefined ? shortDesc : generateShortDesc(desc);
      updatedProject = await sql`
        UPDATE projects 
        SET name = ${name}, "shortDesc" = ${finalShortDesc}, "desc" = ${desc}, "updatedAt" = ${updatedAt}
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (name !== undefined && newThumbnail !== undefined) {
      updatedProject = await sql`
        UPDATE projects 
        SET name = ${name}, thumbnail = ${newThumbnail}, "updatedAt" = ${updatedAt}
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (desc !== undefined && newThumbnail !== undefined) {
      const finalShortDesc =
        shortDesc !== undefined ? shortDesc : generateShortDesc(desc);
      updatedProject = await sql`
        UPDATE projects 
        SET "shortDesc" = ${finalShortDesc}, "desc" = ${desc}, thumbnail = ${newThumbnail}, "updatedAt" = ${updatedAt}
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (name !== undefined) {
      updatedProject = await sql`
        UPDATE projects 
        SET name = ${name}, "updatedAt" = ${updatedAt}
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (desc !== undefined) {
      const finalShortDesc =
        shortDesc !== undefined ? shortDesc : generateShortDesc(desc);
      updatedProject = await sql`
        UPDATE projects 
        SET "shortDesc" = ${finalShortDesc}, "desc" = ${desc}, "updatedAt" = ${updatedAt}
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (shortDesc !== undefined) {
      updatedProject = await sql`
        UPDATE projects 
        SET "shortDesc" = ${shortDesc}, "updatedAt" = ${updatedAt}
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (newThumbnail !== undefined) {
      updatedProject = await sql`
        UPDATE projects 
        SET thumbnail = ${newThumbnail}, "updatedAt" = ${updatedAt}
        WHERE id = ${id}
        RETURNING *
      `;
    } else {
      // No fields to update
      updatedProject = existingProject;
    }

    let updatedThumb;
    try {
      updatedThumb =
        typeof updatedProject[0].thumbnail === 'string'
          ? JSON.parse(updatedProject[0].thumbnail)
          : updatedProject[0].thumbnail;
    } catch {
      updatedThumb = { url: updatedProject[0].thumbnail, filename: null };
    }

    const responseData = {
      id: updatedProject[0].id,
      name: updatedProject[0].name,
      shortDesc: updatedProject[0].shortdesc,
      desc: updatedProject[0].desc,
      createdAt: updatedProject[0].createdAt,
      updatedAt: updatedProject[0].updatedat,
      thumbnail: updatedThumb,
    };

    res.json({
      code: 200,
      message: 'Project updated successfully',
      data: responseData,
    });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({
      code: 500,
      message: 'Internal Server Error',
      data: null,
    });
  }
}

async function deleteProject(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Check if project exists and get thumbnail URL
    const existingProject = await sql`SELECT * FROM projects WHERE id = ${id}`;
    if (existingProject.length === 0) {
      res.status(404).json({
        code: 404,
        message: 'Project not found',
      });
    }

    // Delete thumbnail from Cloudinary
    try {
      const thumbnailUrl = existingProject[0].thumbnail;
      if (thumbnailUrl.includes('cloudinary.com')) {
        const matches = thumbnailUrl.match(/\/project-thumbnails\/([^\.]+)/);
        if (matches && matches[1]) {
          await cloudinary.uploader.destroy(`project-thumbnails/${matches[1]}`);
        }
      }
    } catch (cloudinaryError) {
      console.error(
        'Error deleting thumbnail from Cloudinary:',
        cloudinaryError
      );
      // Continue with project deletion even if thumbnail deletion fails
    }

    // Delete project from database
    await sql`DELETE FROM projects WHERE id = ${id}`;

    res.json({
      code: 200,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({
      code: 500,
      message: 'Internal Server Error',
    });
  }
}

export {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
};
