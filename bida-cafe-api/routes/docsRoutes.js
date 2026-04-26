const express = require('express');

function buildOpenApiSpec(serverUrl) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Bida Cafe API',
      version: '1.0.0',
      description: 'Tai lieu API cho user app Flutter va web admin.',
    },
    servers: [{ url: serverUrl }],
    tags: [
      { name: 'Mobile Auth' },
      { name: 'Mobile App' },
      { name: 'Admin Auth' },
      { name: 'Admin' },
      { name: 'Dashboard' },
      { name: 'Membership' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        LoginRequest: {
          type: 'object',
          required: ['phone', 'pin'],
          properties: {
            phone: { type: 'string', example: '0912345678' },
            pin: { type: 'string', example: '1234' },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['fullName', 'phone', 'pin'],
          properties: {
            fullName: { type: 'string', example: 'Nguyen Van A' },
            phone: { type: 'string', example: '0912345678' },
            pin: { type: 'string', example: '1234' },
          },
        },
        BookingRequest: {
          type: 'object',
          required: ['tableId', 'bookingStart', 'durationMinutes'],
          properties: {
            tableId: { type: 'integer', example: 1 },
            bookingStart: {
              type: 'string',
              format: 'date-time',
              example: '2026-04-09T19:30:00+07:00',
            },
            durationMinutes: { type: 'integer', example: 60 },
            notes: { type: 'string', example: 'Gan cua so' },
          },
        },
        OrderRequest: {
          type: 'object',
          required: ['productId', 'quantity'],
          properties: {
            productId: { type: 'integer', example: 1 },
            quantity: { type: 'integer', example: 2 },
            paymentMethod: {
              type: 'string',
              enum: ['CASH', 'WALLET'],
              example: 'CASH',
            },
          },
        },
      },
    },
    paths: {
      '/api/app/auth/register': {
        post: {
          tags: ['Mobile Auth'],
          summary: 'Dang ky user moi',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RegisterRequest' },
              },
            },
          },
          responses: {
            200: { description: 'Dang ky thanh cong' },
          },
        },
      },
      '/api/app/auth/login': {
        post: {
          tags: ['Mobile Auth'],
          summary: 'Dang nhap user app',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginRequest' },
              },
            },
          },
          responses: {
            200: { description: 'Dang nhap thanh cong' },
          },
        },
      },
      '/api/app/me': {
        get: {
          tags: ['Mobile App'],
          summary: 'Lay thong tin user hien tai',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Thong tin user' },
          },
        },
        patch: {
          tags: ['Mobile App'],
          summary: 'Cap nhat ho ten user',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    fullName: { type: 'string', example: 'Nguyen Van B' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Cap nhat thanh cong' },
          },
        },
      },
      '/api/app/tables': {
        get: {
          tags: ['Mobile App'],
          summary: 'Lay danh sach ban',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Danh sach ban' } },
        },
      },
      '/api/app/bookings': {
        get: {
          tags: ['Mobile App'],
          summary: 'Lay danh sach booking cua user',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Danh sach booking' } },
        },
        post: {
          tags: ['Mobile App'],
          summary: 'Dat ban',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BookingRequest' },
              },
            },
          },
          responses: { 200: { description: 'Dat ban thanh cong' } },
        },
      },
      '/api/app/orders': {
        post: {
          tags: ['Mobile App'],
          summary: 'Goi mon tu app',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OrderRequest' },
              },
            },
          },
          responses: { 200: { description: 'Gui don thanh cong' } },
        },
      },
      '/api/app/wallet': {
        get: {
          tags: ['Mobile App'],
          summary: 'Lay thong tin vi',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Thong tin vi' } },
        },
      },
      '/api/app/membership': {
        get: {
          tags: ['Mobile App'],
          summary: 'Lay thong tin hang thanh vien',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Thong tin loyalty' } },
        },
      },
      '/api/admin/auth/login': {
        post: {
          tags: ['Admin Auth'],
          summary: 'Dang nhap admin/staff',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['username', 'password'],
                  properties: {
                    username: { type: 'string', example: 'admin_01' },
                    password: { type: 'string', example: 'hash_password_123' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Dang nhap admin thanh cong' } },
        },
      },
      '/api/admin/auth/me': {
        get: {
          tags: ['Admin Auth'],
          summary: 'Thong tin staff/admin dang dang nhap',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Thong tin tai khoan' } },
        },
      },
      '/api/admin/reports/overview': {
        get: {
          tags: ['Dashboard'],
          summary: 'Tong quan doanh thu',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'period',
              in: 'query',
              schema: { type: 'string', example: 'day' },
            },
            {
              name: 'date',
              in: 'query',
              schema: { type: 'string', example: '2026-04-09' },
            },
          ],
          responses: { 200: { description: 'Du lieu tong quan' } },
        },
      },
      '/api/admin/tables': {
        get: {
          tags: ['Admin'],
          summary: 'Lay tat ca ban bida',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Danh sach ban' } },
        },
      },
      '/api/membership/ranks': {
        get: {
          tags: ['Membership'],
          summary: 'Danh sach hang thanh vien',
          responses: { 200: { description: 'Danh sach rank' } },
        },
      },
    },
  };
}

function createDocsRouter() {
  const router = express.Router();

  router.get('/openapi.json', (req, res) => {
    const serverUrl = `${req.protocol}://${req.get('host')}`;
    res.json(buildOpenApiSpec(serverUrl));
  });

  router.get('/', (req, res) => {
    res.type('html').send(`<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bida Cafe API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #f4f7f8; }
      .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/api/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
      });
    </script>
  </body>
</html>`);
  });

  return router;
}

module.exports = { createDocsRouter };
