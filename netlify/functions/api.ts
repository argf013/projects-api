import express from 'express';
import serverless from 'serverless-http';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import { neon } from '@neondatabase/serverless';
import * as fileController from '../../src/routes/files';
import * as projectController from '../../src/routes/projects';
import {
  basicLimiter,
  strictLimiter,
  uploadLimiter,
} from '../../src/middleware/middleware';

dotenv.config();

const app = express();
const router = express.Router();
const sql = neon(process.env.DATABASE_URL!);

// Middleware
app.set('trust proxy', true); 
app.use(express.json({ limit: '50mb' }));
app.use(basicLimiter);

// route for file operations
router.get('/files', fileController.getAllFiles);
router.get('/files/thumbnails', fileController.getAllThumbnails);
router.post('/files/thumbnail', uploadLimiter, fileController.uploadThumbnail);
router.delete('/files/thumbnail', strictLimiter, fileController.deleteThumbnails);

// route for project operations
router.post('/project', strictLimiter, projectController.createProject);
router.get('/projects', projectController.getAllProjects);
router.get('/project/:id', projectController.getProjectById);
router.put('/project/:id', strictLimiter, projectController.updateProject);
router.delete('/project', strictLimiter, projectController.deleteProject);

router.get('/hello', (req, res) => {
  res.json({ message: 'Hello, world!' });
});

router.get('/init', async (req, res) => {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        "shortDesc" TEXT,
        "desc" TEXT NOT NULL,
        thumbnail TEXT NOT NULL,
        "createdAt" TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP NOT NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS files (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        "createdAt" TIMESTAMP NOT NULL
      )
    `;

    res.json({
      code: 200,
      message: 'Database tables created successfully',
      data: null,
    });
  } catch (error) {
    console.error('Error initializing database:', error);
    res.status(500).json({
      code: 500,
      message: 'Internal Server Error',
      data: null,
    });
  }
});

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

app.use('/.netlify/functions/api', router);

module.exports.handler = serverless(app);
