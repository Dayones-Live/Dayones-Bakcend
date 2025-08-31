## Description

[DayOnes.io](https://github.com/hakeemsyd/daysone-backend.git) Backend repository

## API Endpoints

### Profile Endpoints

#### Public Endpoints (No Authentication Required)

**Get User Profile**
```
GET /api/v1/profile/:userId
```
Get any user's public profile information
- **Parameters**: `userId` (UUID string) in URL path
- **Response**: User profile with bio, description, social media links, etc.

**Get User Gallery**
```
GET /api/v1/profile/gallery/:userId
```
Get any user's public gallery images
- **Parameters**: `userId` (UUID string) in URL path
- **Response**: Array of gallery images for that user

#### Protected Endpoints (Require Authentication)

**Get My Profile**
```
GET /api/v1/profile/me
```
Get the authenticated user's own profile
- **Authentication**: Required (Bearer token)
- **Response**: Same as public profile but for authenticated user

**Get My Gallery**
```
GET /api/v1/profile/gallery/me
```
Get the authenticated user's own gallery
- **Authentication**: Required (Bearer token)
- **Response**: Array of gallery images for authenticated user

**Update Profile**
```
POST /api/v1/profile/update
```
Update user's own profile information
- **Authentication**: Required (Bearer token)
- **Body**: ProfileUpdateInput object
  ```json
  {
    "bio": "User bio (max 500 chars)",
    "description": "User description (max 1000 chars)",
    "website": "https://example.com",
    "instagram": "@username",
    "twitter": "@username",
    "facebook": "username",
    "tiktok": "@username",
    "youtube": "username"
  }
  ```

**Add Gallery Image**
```
POST /api/v1/profile/gallery/add
```
Add a new image to user's own gallery
- **Authentication**: Required (Bearer token)
- **Body**: GalleryImageInput object
  ```json
  {
    "image_url": "https://example.com/image.jpg",
    "caption": "Image caption (max 200 chars)",
    "alt_text": "Alt text (max 100 chars)",
    "display_order": 1
  }
  ```

**Update Gallery Image**
```
PUT /api/v1/profile/gallery/:imageId
```
Update an existing gallery image
- **Authentication**: Required (Bearer token)
- **Parameters**: `imageId` (string) in URL path
- **Body**: GalleryImageUpdateInput object
  ```json
  {
    "image_url": "https://example.com/image.jpg",
    "caption": "Updated caption",
    "alt_text": "Updated alt text",
    "display_order": 2,
    "is_active": true
  }
  ```

**Delete Gallery Image**
```
DELETE /api/v1/profile/gallery/:imageId
```
Delete a gallery image
- **Authentication**: Required (Bearer token)
- **Parameters**: `imageId` (string) in URL path

### Response Format

All endpoints return responses in the following format:

```json
{
  "statusCode": 200,
  "message": "Success message",
  "data": {
    // Response data
  }
}
```

### Authentication

Protected endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Error Responses

- **400 Bad Request**: Validation errors (bio too long, invalid website format)
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Unauthorized gallery operations
- **404 Not Found**: Non-existent users or images
- **500 Internal Server Error**: Server issues

## Project setup

```bash
$ yarn install
```

## Compile and run the project

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Migrations

### Production: To generate / run / revert a migration, make build first

```bash
yarn build
```

### Generate a migration from existing table schema <br />

Automatic migration generation creates a new migration file and writes all sql queries that must be executed to update the database

```bash
TableName=<name> yarn migration:generate
```

### Run migrations <br />

To execute all pending migrations use following command:

To run a migration on local / development

```bash
yarn local-migration:run
```
To run a migration on production
```bash
yarn prod-migration:run
```

### Revert migrations <br />

To revert the most recently executed migration use the following command:

To revert a migration on local / development

```bash
yarn local-migration:revert
```
To revert a migration on production

```bash
yarn prod-migration:revert
```

### Show migrations <br />

To show all migrations and whether they've been run or not use following command:

To show migrations on local / development

```bash
yarn local-migration:show
```
To show migrations on production

```bash
yarn prod-migration:show
```
