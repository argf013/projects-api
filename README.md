# Projects API

A simple API to manage project data along with thumbnail images, built with Express, TypeScript, Neon (serverless PostgreSQL), and Cloudinary for image storage.

## Features

- CRUD Project (Create, Read, Update, Delete)
- Upload and manage thumbnail files (Cloudinary)
- Pagination for project and file listing
- Endpoint to initialize the database (tables)
- Public HTML uploader for thumbnails

## Folder Structure

- `netlify/functions/api.ts` — Netlify Function entry point (Express API)
- `routes/` — Endpoint logic for projects & files
- `public/` — Static HTML uploader
- `dist/` — TypeScript build output

## Setup & Installation

1. **Clone the repo & install dependencies**

   ```bash
   npm install
   ```

2. **Create a `.env` file**

   ```
   DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require
   CLOUD_NAME=your_cloud_name
   API_KEY=your_api_key
   API_SECRET=your_api_secret
   ```

3. **Build TypeScript**

   ```bash
   npm run build
   ```

4. **Run locally (Netlify Dev)**
   ```bash
   npm run dev
   ```

## API Endpoints

All endpoints are prefixed with `/api` (or `/.netlify/functions/api` on Netlify).

### Project

- `GET    /projects` — List projects (pagination: `page`, `limit`)
- `GET    /project/:id` — Project details
- `POST   /project` — Add a project
- `PUT    /project/:id` — Update a project
- `DELETE /project/:id` — Delete a project

### File & Thumbnail

- `GET  /files` — List thumbnail files
- `GET  /files/thumbnails` — List thumbnails from Cloudinary
- `POST /files/thumbnail` — Upload thumbnail (body: `{ file: base64, filename: string }`)

### Database Initialization

- `GET /init` — Create `projects` & `files` tables if they do not exist

## Example Thumbnail Upload Request

```http
POST /files/thumbnail
Content-Type: application/json

{
  "file": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "filename": "myimage.png"
}
```

## Static Uploader

Open `public/index.html` to visually upload thumbnails.

## Deployment

- Ready to deploy on Netlify (see `netlify.toml` and `_redirects`)
- Make sure environment variables are set in the Netlify dashboard

## License

MIT
