# Learning Guide for Projects API

This document provides a quick learning path for understanding and contributing to the Projects API.

## 1. Project Structure

- **netlify/functions/api.ts**: Main Express API entry point.
- **routes/**: Contains logic for `/projects` and `/files` endpoints.
- **public/**: Static HTML uploader for thumbnails.
- **dist/**: Compiled TypeScript output.

## 2. Key Technologies

- **Express.js**: Web framework for API endpoints.
- **TypeScript**: Type safety and modern JS features.
- **Neon**: Serverless PostgreSQL database.
- **Cloudinary**: Image storage and CDN.

## 3. Main Features

- CRUD operations for projects.
- Upload and manage project thumbnails.
- Pagination for listing projects and files.
- Database initialization endpoint.
- Static uploader for easy thumbnail uploads.

## 4. How to Explore

- Start with `README.md` for setup and API usage.
- Review `routes/projects.ts` and `routes/files.ts` for endpoint logic.
- Use `public/index.html` to test thumbnail uploads visually.
- Check `netlify/functions/api.ts` for route registration and middleware.

## 5. Useful Commands

- `npm install` — Install dependencies.
- `npm run build` — Compile TypeScript.
- `npm run dev` — Start local Netlify dev server.

## 6. Next Steps

- Try adding a new endpoint or feature.
- Explore the database schema in `/init` endpoint.
- Experiment with Cloudinary API for advanced image handling.

---

Happy learning and contributing!
