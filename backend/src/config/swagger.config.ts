/**
 * Swagger API Documentation Configuration
 * 
 * This module establishes the OpenAPI 3.0 specification for AI Job Chommie's
 * RESTful API architecture. The configuration provides comprehensive documentation
 * for all endpoints, authentication mechanisms, and data schemas utilized
 * throughout the platform.
 * 
 * @module SwaggerConfiguration
 * @version 2.0.0
 * @since 2024
 */

import swaggerJsdoc from 'swagger-jsdoc';
import { version } from '../../package.json';

/**
 * OpenAPI Specification Configuration
 * 
 * Defines the comprehensive API documentation structure following OpenAPI 3.0.3 standards.
 * This configuration ensures complete visibility into our API architecture, enabling
 * seamless integration for enterprise partners and third-party developers.
 */
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'AI Job Chommie Professional API',
      version,
      description: `
        AI Job Chommie represents the pinnacle of artificial intelligence-driven recruitment technology,
        offering a sophisticated suite of RESTful APIs designed to revolutionize the employment landscape
        across South Africa and beyond.

        This comprehensive API documentation provides enterprise-grade integration capabilities,
        enabling seamless connectivity with existing HR systems, applicant tracking platforms,
        and corporate recruitment infrastructures.

        Our API architecture embraces industry-leading security protocols, including OAuth 2.0
        authentication, JWT token management, and end-to-end encryption, ensuring the highest
        standards of data protection and regulatory compliance.
      `,
      termsOfService: 'https://aijobchommie.co.za/terms',
      contact: {
        name: 'Enterprise API Support Team',
        email: 'api-support@aijobchommie.co.za',
        url: 'https://aijobchommie.co.za/api-support'
      },
      license: {
        name: 'Proprietary Enterprise License',
        url: 'https://aijobchommie.co.za/api-license'
      },
      'x-logo': {
        url: 'https://aijobchommie.co.za/assets/api-logo.png',
        altText: 'AI Job Chommie Professional API'
      }
    },
    externalDocs: {
      description: 'Comprehensive API Integration Guide',
      url: 'https://docs.aijobchommie.co.za'
    },
    servers: [
      {
        url: 'https://api.aijobchommie.co.za/v2',
        description: 'Production Environment - Enterprise Grade Infrastructure',
        variables: {
          protocol: {
            enum: ['https'],
            default: 'https'
          }
        }
      },
      {
        url: 'https://staging-api.aijobchommie.co.za/v2',
        description: 'Staging Environment - Pre-Production Testing',
        variables: {
          protocol: {
            enum: ['https'],
            default: 'https'
          }
        }
      },
      {
        url: 'http://localhost:3000/api/v2',
        description: 'Development Environment - Local Testing',
        variables: {
          protocol: {
            enum: ['http', 'https'],
            default: 'http'
          }
        }
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Authentication token issued upon successful authentication'
        },
        OAuth2: {
          type: 'oauth2',
          flows: {
            authorizationCode: {
              authorizationUrl: 'https://auth.aijobchommie.co.za/oauth/authorize',
              tokenUrl: 'https://auth.aijobchommie.co.za/oauth/token',
              refreshUrl: 'https://auth.aijobchommie.co.za/oauth/refresh',
              scopes: {
                'read:profile': 'Access user profile information',
                'write:profile': 'Modify user profile information',
                'read:jobs': 'View job listings and applications',
                'write:jobs': 'Create and manage job postings',
                'read:candidates': 'Access candidate information',
                'write:candidates': 'Manage candidate profiles',
                'admin:system': 'Full system administration access'
              }
            }
          }
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Enterprise API Key for partner integrations'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'Application-specific error code'
            },
            message: {
              type: 'string',
              description: 'Human-readable error message'
            },
            details: {
              type: 'object',
              description: 'Additional error context and debugging information'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'ISO 8601 timestamp of error occurrence'
            },
            traceId: {
              type: 'string',
              description: 'Unique identifier for request tracing'
            }
          },
          required: ['code', 'message', 'timestamp', 'traceId']
        },
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              minimum: 1,
              default: 1,
              description: 'Current page number'
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: 'Number of items per page'
            },
            totalPages: {
              type: 'integer',
              description: 'Total number of pages available'
            },
            totalItems: {
              type: 'integer',
              description: 'Total number of items in collection'
            },
            hasNext: {
              type: 'boolean',
              description: 'Indicates if next page exists'
            },
            hasPrevious: {
              type: 'boolean',
              description: 'Indicates if previous page exists'
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Operation success indicator'
            },
            message: {
              type: 'string',
              description: 'Success message'
            },
            data: {
              type: 'object',
              description: 'Response payload'
            },
            metadata: {
              type: 'object',
              properties: {
                timestamp: {
                  type: 'string',
                  format: 'date-time'
                },
                version: {
                  type: 'string'
                },
                requestId: {
                  type: 'string'
                }
              }
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication credentials are missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                code: 'AUTH_001',
                message: 'Invalid authentication credentials',
                timestamp: '2024-01-20T10:30:00Z',
                traceId: 'trace-123456'
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Insufficient permissions to access the requested resource',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        NotFoundError: {
          description: 'The requested resource could not be found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        ValidationError: {
          description: 'Request validation failed',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        ServerError: {
          description: 'Internal server error occurred',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        }
      },
      parameters: {
        PageParam: {
          name: 'page',
          in: 'query',
          description: 'Page number for pagination',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            default: 1
          }
        },
        LimitParam: {
          name: 'limit',
          in: 'query',
          description: 'Number of items per page',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20
          }
        },
        SortParam: {
          name: 'sort',
          in: 'query',
          description: 'Sort field and direction (e.g., "createdAt:desc")',
          required: false,
          schema: {
            type: 'string'
          }
        },
        FilterParam: {
          name: 'filter',
          in: 'query',
          description: 'Filter criteria in JSON format',
          required: false,
          schema: {
            type: 'string'
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints',
        'x-displayName': 'Authentication & Security'
      },
      {
        name: 'User Management',
        description: 'User profile and account management operations',
        'x-displayName': 'User Profiles'
      },
      {
        name: 'Job Management',
        description: 'Job posting, searching, and application endpoints',
        'x-displayName': 'Job Listings'
      },
      {
        name: 'Candidate Operations',
        description: 'Candidate screening, matching, and communication',
        'x-displayName': 'Candidate Management'
      },
      {
        name: 'Employer Services',
        description: 'Employer-specific features and recruitment tools',
        'x-displayName': 'Employer Portal'
      },
      {
        name: 'AI Services',
        description: 'Artificial intelligence and machine learning endpoints',
        'x-displayName': 'AI & ML Services'
      },
      {
        name: 'Analytics',
        description: 'Platform analytics and reporting endpoints',
        'x-displayName': 'Analytics & Insights'
      },
      {
        name: 'Payments',
        description: 'Subscription and payment processing endpoints',
        'x-displayName': 'Billing & Payments'
      },
      {
        name: 'Notifications',
        description: 'Notification and messaging system endpoints',
        'x-displayName': 'Communications'
      },
      {
        name: 'System',
        description: 'System health and maintenance endpoints',
        'x-displayName': 'System Operations'
      }
    ],
    'x-tagGroups': [
      {
        name: 'Core Services',
        tags: ['Authentication', 'User Management', 'Job Management']
      },
      {
        name: 'Advanced Features',
        tags: ['AI Services', 'Analytics', 'Candidate Operations']
      },
      {
        name: 'Business Operations',
        tags: ['Employer Services', 'Payments', 'Notifications']
      },
      {
        name: 'System Administration',
        tags: ['System']
      }
    ]
  },
  apis: [
    './src/routes/*.ts',
    './src/routes/**/*.ts',
    './src/controllers/*.ts',
    './src/controllers/**/*.ts',
    './src/models/*.ts',
    './src/models/**/*.ts'
  ]
};

export default swaggerOptions;

/**
 * Custom Swagger UI Configuration
 * 
 * Enhances the Swagger UI with enterprise branding and advanced features
 */
export const swaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { 
      background-color: #1a1a2e; 
      border-bottom: 2px solid #0f3460;
    }
    .swagger-ui .topbar .wrapper { 
      padding: 15px 0; 
    }
    .swagger-ui .topbar .link {
      display: none;
    }
    .swagger-ui .scheme-container {
      background: #f7f7f7;
      padding: 15px;
      border-radius: 5px;
    }
    .swagger-ui .btn.authorize {
      background-color: #0f3460;
      color: white;
      border: none;
    }
    .swagger-ui .btn.authorize:hover {
      background-color: #16213e;
    }
    .swagger-ui .opblock.opblock-post .opblock-summary {
      border-color: #49a555;
    }
    .swagger-ui .opblock.opblock-get .opblock-summary {
      border-color: #4990e2;
    }
    .swagger-ui .opblock.opblock-put .opblock-summary {
      border-color: #ff9900;
    }
    .swagger-ui .opblock.opblock-delete .opblock-summary {
      border-color: #f44336;
    }
  `,
  customSiteTitle: 'AI Job Chommie API Documentation',
  customfavIcon: '/assets/favicon.ico',
  swaggerOptions: {
    deepLinking: true,
    displayOperationId: false,
    defaultModelsExpandDepth: 1,
    defaultModelExpandDepth: 1,
    defaultModelRendering: 'example',
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true,
    persistAuthorization: true,
    syntaxHighlight: {
      activate: true,
      theme: 'monokai'
    },
    requestSnippetsEnabled: true,
    requestSnippets: {
      generators: {
        curl_bash: {
          title: 'cURL (Bash)',
          syntax: 'bash'
        },
        curl_powershell: {
          title: 'cURL (PowerShell)',
          syntax: 'powershell'
        },
        curl_cmd: {
          title: 'cURL (CMD)',
          syntax: 'bash'
        },
        node_native: {
          title: 'Node.js (Native)',
          syntax: 'javascript'
        },
        node_axios: {
          title: 'Node.js (Axios)',
          syntax: 'javascript'
        },
        python_requests: {
          title: 'Python (Requests)',
          syntax: 'python'
        },
        java_okhttp: {
          title: 'Java (OkHttp)',
          syntax: 'java'
        },
        csharp_restsharp: {
          title: 'C# (RestSharp)',
          syntax: 'csharp'
        }
      }
    }
  }
};
