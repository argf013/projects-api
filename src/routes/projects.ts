import { Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { neon } from '@neondatabase/serverless';
import { v2 as cloudinary } from 'cloudinary';

interface Thumbnail {
  url: string;
  filename: string | null;
  id: string;
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

const getAllProjects = async (req: Request, res: Response) => {
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
      total: parseInt(total),
      totalPages: Math.ceil(total / limit),
      data: transformedProjects,
      pagination: {
        page,
        limit,
      },
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res
      .status(500)
      .json({ code: 500, message: 'Internal Server Error', data: null });
  }
};

const getProjectById = async (req: Request, res: Response): Promise<void> => {
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
};

const createProject = async (req: Request, res: Response): Promise<void> => {
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
      const files =
        await sql`SELECT * FROM files WHERE filename = ${thumbnail} LIMIT 1`;
      if (files.length > 0) {
        thumbnailObj = {
          url: files[0].url,
          filename: files[0].filename,
          id: files[0].id,
        };
        valid = true;
      } else if (isValidUrl(thumbnail)) {
        thumbnailObj = { url: thumbnail, filename: null, id: null };
        valid = true;
      }
    } else if (
      typeof thumbnail === 'object' &&
      thumbnail.url &&
      thumbnail.filename
    ) {
      if (isValidUrl(thumbnail.url)) {
        // If thumbnail object already has an id, use it; otherwise look it up
        let thumbnailId = thumbnail.id || null;
        if (!thumbnailId && thumbnail.filename) {
          const files =
            await sql`SELECT id FROM files WHERE filename = ${thumbnail.filename} LIMIT 1`;
          if (files.length > 0) {
            thumbnailId = files[0].id;
          }
        }
        thumbnailObj = {
          url: thumbnail.url,
          filename: thumbnail.filename,
          id: thumbnailId,
        };
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
};

const updateProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, shortDesc, desc, thumbnail } = req.body;

    const existingProject = await sql`SELECT * FROM projects WHERE id = ${id}`;
    if (existingProject.length === 0) {
      res.status(404).json({
        code: 404,
        message: 'Project not found',
        data: null,
      });
      return;
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
            id: files[0].id,
          };
          valid = true;
        } else if (isValidUrl(thumbnail)) {
          thumbnailObj = { url: thumbnail, filename: null, id: null };
          valid = true;
        }
      } else if (
        typeof thumbnail === 'object' &&
        thumbnail.url &&
        thumbnail.filename
      ) {
        if (isValidUrl(thumbnail.url)) {
          // If thumbnail object already has an id, use it; otherwise look it up
          let thumbnailId = thumbnail.id || null;
          if (!thumbnailId && thumbnail.filename) {
            const files =
              await sql`SELECT id FROM files WHERE filename = ${thumbnail.filename} LIMIT 1`;
            if (files.length > 0) {
              thumbnailId = files[0].id;
            }
          }
          thumbnailObj = {
            url: thumbnail.url,
            filename: thumbnail.filename,
            id: thumbnailId,
          };
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
        return;
      }
      newThumbnail = JSON.stringify(thumbnailObj);
    }

    // Parse old thumbnail for comparison
    let oldThumbnailObj = null;
    if (currentProject.thumbnail) {
      try {
        oldThumbnailObj =
          typeof currentProject.thumbnail === 'string'
            ? JSON.parse(currentProject.thumbnail)
            : currentProject.thumbnail;
      } catch {
        oldThumbnailObj = {
          url: currentProject.thumbnail,
          filename: null,
          id: null,
        };
      }
    }

    // Function to compare thumbnails
    const isSameThumbnail = (oldThumb: any, newThumb: any): boolean => {
      if (!oldThumb || !newThumb) return false;
      
      // Compare by URL first (most reliable)
      if (oldThumb.url && newThumb.url && oldThumb.url === newThumb.url) {
        return true;
      }
      
      // Compare by id if both have it
      if (oldThumb.id && newThumb.id && oldThumb.id === newThumb.id) {
        return true;
      }
      
      // Compare by filename if both have it
      if (oldThumb.filename && newThumb.filename && oldThumb.filename === newThumb.filename) {
        return true;
      }
      
      return false;
    };

    // Enhanced old thumbnail deletion logic with comparison check
    if (thumbnail !== undefined && currentProject.thumbnail && !isSameThumbnail(oldThumbnailObj, thumbnailObj)) {
      try {
        if (
          oldThumbnailObj &&
          oldThumbnailObj.url &&
          typeof oldThumbnailObj.url === 'string' &&
          oldThumbnailObj.url.includes('cloudinary.com')
        ) {
          let publicId = null;
          let fileRecord = null;

          // Priority 1: Use the id from thumbnail object if available
          if (oldThumbnailObj.id) {
            if (oldThumbnailObj.id.startsWith('project-thumbnails/')) {
              publicId = oldThumbnailObj.id; // Already has the full path
            } else {
              publicId = `project-thumbnails/${oldThumbnailObj.id}`;
            }

            // Get the file record for deletion from files table using the public id
            fileRecord = await sql`
              SELECT * FROM files WHERE id = ${publicId} LIMIT 1
            `;
          } else {
            // Fallback: extract from URL pattern if id is not available
            const matches = oldThumbnailObj.url.match(
              /\/project-thumbnails\/([^\.]+)/
            );
            if (matches && matches[1]) {
              publicId = `project-thumbnails/${matches[1]}`;

              // Try to get file record using the extracted public id
              fileRecord = await sql`
                SELECT * FROM files WHERE id = ${publicId} LIMIT 1
              `;
            }
          }

          if (publicId) {
            try {
              const result = await cloudinary.uploader.destroy(publicId);
              console.log(`Old thumbnail deleted from Cloudinary: ${result.result}`);

              // Delete from files table if file record exists
              if (fileRecord && fileRecord.length > 0) {
                await sql`DELETE FROM files WHERE id = ${publicId}`;
                console.log(`File record deleted from database: ${publicId}`);
              }
            } catch (cloudinaryError) {
              console.error(
                'Error deleting old thumbnail from Cloudinary:',
                cloudinaryError
              );
            }
          } else {
            console.error(
              `Could not determine public ID for old thumbnail: ${JSON.stringify(
                oldThumbnailObj
              )}`
            );
          }
        }
      } catch (error) {
        console.error('Error processing old thumbnail deletion:', error);
      }
    } else if (thumbnail !== undefined && isSameThumbnail(oldThumbnailObj, thumbnailObj)) {
      console.log('New thumbnail is the same as old thumbnail, skipping deletion');
    }

    let updatedProject;

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
};

const deleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({
        code: 400,
        message:
          'ids array is required and must contain at least one project ID',
      });
      return;
    }

    const existingProjects =
      await sql`SELECT * FROM projects WHERE id = ANY(${ids})`;

    if (existingProjects.length === 0) {
      res.status(404).json({
        code: 404,
        message: 'No projects found with the provided IDs',
      });
      return;
    }

    const foundIds = existingProjects.map((project: any) => project.id);
    const notFoundIds = ids.filter((id: string) => !foundIds.includes(id));

    if (notFoundIds.length > 0) {
      res.status(404).json({
        code: 404,
        message: `Projects not found with IDs: ${notFoundIds.join(', ')}`,
      });
      return;
    }

    const cloudinaryDeletionResults = [];
    for (const project of existingProjects) {
      try {
        let thumbnailObj = null;
        try {
          thumbnailObj =
            typeof project.thumbnail === 'string'
              ? JSON.parse(project.thumbnail)
              : project.thumbnail;
        } catch {
          thumbnailObj = { url: project.thumbnail, filename: null, id: null };
        }

        if (
          thumbnailObj &&
          thumbnailObj.url &&
          typeof thumbnailObj.url === 'string' &&
          thumbnailObj.url.includes('cloudinary.com')
        ) {
          let publicId = null;
          let fileRecord = null;
          let fileId = null;

          // Priority 1: Use the id from thumbnail object if available
          if (thumbnailObj.id) {
            if (thumbnailObj.id.startsWith('project-thumbnails/')) {
              publicId = thumbnailObj.id; // Already has the full path
            }

            // Get the file record for deletion from files table using the public id
            fileRecord = await sql`
              SELECT * FROM files WHERE id = ${publicId} LIMIT 1
            `;
          }

          if (publicId) {
            const result = await cloudinary.uploader.destroy(publicId);

            // Delete from files table if file record exists
            if (fileRecord && fileRecord.length > 0) {
              await sql`DELETE FROM files WHERE id = ${publicId}`;
            }

            cloudinaryDeletionResults.push({
              id: project.id,
              success: result.result === 'ok',
              publicId: publicId,
              cloudinaryResult: result.result,
              fileDeleted: fileRecord && fileRecord.length > 0,
              thumbnailId: thumbnailObj.id,
              filename: thumbnailObj.filename,
            });
          } else {
            console.error(
              `Could not determine public ID for thumbnail: ${JSON.stringify(
                thumbnailObj
              )}`
            );
            cloudinaryDeletionResults.push({
              id: project.id,
              success: false,
              error: 'Could not determine public ID for thumbnail',
              thumbnailObj: thumbnailObj,
            });
          }
        } else {
          cloudinaryDeletionResults.push({
            id: project.id,
            success: true,
            note: 'No Cloudinary URL found or not a Cloudinary image',
            thumbnailObj: thumbnailObj,
          });
        }
      } catch (cloudinaryError) {
        console.error(
          `Error deleting thumbnail from Cloudinary for project ${project.id}:`,
          cloudinaryError
        );
        cloudinaryDeletionResults.push({
          id: project.id,
          success: false,
          error:
            cloudinaryError instanceof Error
              ? cloudinaryError.message
              : 'Unknown error',
        });
      }
    }

    // Delete projects from database
    await sql`DELETE FROM projects WHERE id = ANY(${ids})`;

    const message =
      ids.length === 1
        ? 'Project deleted successfully'
        : `${ids.length} projects deleted successfully`;

    res.json({
      code: 200,
      message,
      data: {
        deletedIds: foundIds,
        thumbnailDeletionResults: cloudinaryDeletionResults,
      },
    });
  } catch (error) {
    console.error('Error deleting project(s):', error);
    res.status(500).json({
      code: 500,
      message: 'Internal Server Error',
    });
  }
};

export {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
};
