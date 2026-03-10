type HttpMethod = "get" | "post" | "put" | "delete" | "patch";

type OpenApiOperation = {
  summary: string;
  tags?: string[];
  requestBody?: Record<string, unknown>;
  responses?: Record<string, unknown>;
  parameters?: Array<Record<string, unknown>>;
};

type OpenApiPathMap = Record<string, Partial<Record<HttpMethod, OpenApiOperation>>>;

function createJsonRequestBody(schemaRef: string, required = true) {
  return {
    required,
    content: {
      "application/json": {
        schema: {
          $ref: schemaRef,
        },
      },
    },
  };
}

function createJsonResponse(statusDescription: string, schemaRef = "#/components/schemas/GenericResponse") {
  return {
    description: statusDescription,
    content: {
      "application/json": {
        schema: {
          $ref: schemaRef,
        },
      },
    },
  };
}

function inferTag(path: string): string {
  if (path.startsWith("/auth/")) return "auth";
  if (path.startsWith("/workspaces/")) return "workspaces";
  if (path.startsWith("/aws/")) return "aws";
  if (path.startsWith("/incidents")) return "incidents";
  if (path.startsWith("/automation/")) return "automation";
  if (path.startsWith("/notifications/")) return "notifications";
  if (path.startsWith("/ai/")) return "ai";
  if (path.startsWith("/metrics") || path.startsWith("/stream/")) return "metrics";
  if (path.startsWith("/user/")) return "settings";
  if (path.startsWith("/usage/")) return "usage";
  if (path.startsWith("/billing/")) return "billing";
  if (path.startsWith("/tenancy/")) return "tenancy";
  if (path.startsWith("/servers")) return "infrastructure";
  if (path.startsWith("/alerts")) return "alerts";
  return "legacy";
}

function applyOperationDefaults(paths: OpenApiPathMap): OpenApiPathMap {
  const methods: HttpMethod[] = ["get", "post", "put", "delete", "patch"];

  for (const [path, pathOperations] of Object.entries(paths)) {
    for (const method of methods) {
      const operation = pathOperations[method];
      if (!operation) continue;

      const tag = inferTag(path);
      operation.tags = operation.tags?.length ? operation.tags : [tag];

      if (!operation.responses) {
        if (path.includes("/stream/")) {
          operation.responses = {
            "200": {
              description: "Server-sent events stream.",
              content: {
                "text/event-stream": {
                  schema: {
                    type: "string",
                  },
                },
              },
            },
            "401": createJsonResponse("Not authenticated.", "#/components/schemas/ErrorResponse"),
            "500": createJsonResponse("Server error.", "#/components/schemas/ErrorResponse"),
          };
        } else if (path.endsWith("/export")) {
          operation.responses = {
            "200": {
              description: "Export generated successfully.",
              content: {
                "text/plain": {
                  schema: {
                    type: "string",
                  },
                },
              },
            },
            "401": createJsonResponse("Not authenticated.", "#/components/schemas/ErrorResponse"),
            "404": createJsonResponse("Resource not found.", "#/components/schemas/ErrorResponse"),
            "500": createJsonResponse("Server error.", "#/components/schemas/ErrorResponse"),
          };
        } else {
          const successStatus = method === "post" && !path.includes("/login") ? "201" : "200";
          operation.responses = {
            [successStatus]: createJsonResponse("Success."),
            "400": createJsonResponse("Validation failed.", "#/components/schemas/ErrorResponse"),
            "401": createJsonResponse("Not authenticated.", "#/components/schemas/ErrorResponse"),
            "403": createJsonResponse("Forbidden.", "#/components/schemas/ErrorResponse"),
            "404": createJsonResponse("Resource not found.", "#/components/schemas/ErrorResponse"),
            "429": createJsonResponse("Rate limited.", "#/components/schemas/ErrorResponse"),
            "500": createJsonResponse("Server error.", "#/components/schemas/ErrorResponse"),
          };
        }
      }

      const needsRequestBody = method === "post" || method === "put" || method === "patch";
      if (needsRequestBody && !operation.requestBody && !path.endsWith("/accept") && !path.endsWith("/disconnect") && !path.endsWith("/connect")) {
        operation.requestBody = createJsonRequestBody("#/components/schemas/GenericMutationRequest");
      }
    }
  }

  return paths;
}

export function getOpenApiSpec(apiVersion: string) {
  const paths: OpenApiPathMap = {
    "/auth/register": {
      post: {
        summary: "Register user account",
        requestBody: createJsonRequestBody("#/components/schemas/RegisterRequest"),
        responses: {
          "201": createJsonResponse("Account created.", "#/components/schemas/RegisterResponse"),
          "409": createJsonResponse("Email already exists.", "#/components/schemas/ErrorResponse"),
        },
      },
    },
    "/auth/login": {
      post: {
        summary: "Login with email/password",
        requestBody: createJsonRequestBody("#/components/schemas/LoginRequest"),
        responses: {
          "200": createJsonResponse("Login successful.", "#/components/schemas/AuthSessionResponse"),
          "401": createJsonResponse("Invalid credentials.", "#/components/schemas/ErrorResponse"),
        },
      },
    },
    "/auth/logout": { post: { summary: "Logout current session" } },
    "/auth/me": { get: { summary: "Get current session user" } },
    "/auth/request-password-reset": {
      post: {
        summary: "Create password reset token",
        requestBody: createJsonRequestBody("#/components/schemas/EmailRequest"),
      },
    },
    "/auth/reset-password": {
      post: {
        summary: "Reset account password",
        requestBody: createJsonRequestBody("#/components/schemas/ResetPasswordRequest"),
      },
    },
    "/auth/request-email-verification": {
      post: { summary: "Create email verification token" },
    },
    "/auth/verify-email": {
      post: {
        summary: "Verify account email",
        requestBody: createJsonRequestBody("#/components/schemas/TokenRequest"),
      },
    },
    "/workspaces/me": { get: { summary: "Get active workspace membership" } },
    "/workspaces/invitations": {
      post: {
        summary: "Create workspace invitation",
        requestBody: createJsonRequestBody("#/components/schemas/WorkspaceInviteRequest"),
      },
    },
    "/workspaces/invitations/{token}/accept": {
      post: {
        summary: "Accept workspace invitation",
        parameters: [
          {
            in: "path",
            name: "token",
            required: true,
            schema: { type: "string" },
          },
        ],
      },
    },
    "/aws/config": {
      get: { summary: "Get AWS integration config" },
      put: {
        summary: "Update AWS integration config",
        requestBody: createJsonRequestBody("#/components/schemas/AwsConfigUpdateRequest"),
      },
    },
    "/aws/connect": { post: { summary: "Connect AWS workspace integration" } },
    "/aws/disconnect": { post: { summary: "Disconnect AWS workspace integration" } },
    "/aws/overview": { get: { summary: "Get AWS operations overview summary" } },
    "/aws/resources": { get: { summary: "List AWS infrastructure resources" } },
    "/aws/resources/{id}/actions": {
      post: {
        summary: "Execute quick resource action",
        requestBody: createJsonRequestBody("#/components/schemas/ResourceActionRequest"),
      },
    },
    "/aws/incidents": { get: { summary: "List AWS incidents" } },
    "/aws/incidents/{id}/status": {
      put: {
        summary: "Update AWS incident lifecycle status",
        requestBody: createJsonRequestBody("#/components/schemas/IncidentStatusUpdateRequest"),
      },
    },
    "/aws/incidents/{id}/assignment": {
      put: {
        summary: "Assign incident owner/team",
        requestBody: createJsonRequestBody("#/components/schemas/IncidentAssignmentRequest"),
      },
    },
    "/aws/incidents/{id}/acknowledge": { post: { summary: "Acknowledge incident" } },
    "/aws/incidents/{id}/escalate": { post: { summary: "Escalate incident" } },
    "/aws/playbooks": {
      get: { summary: "List auto-healing playbooks" },
      post: {
        summary: "Create auto-healing playbook",
        requestBody: createJsonRequestBody("#/components/schemas/PlaybookCreateRequest"),
      },
    },
    "/aws/playbooks/{id}/enabled": {
      put: {
        summary: "Enable or disable playbook",
        requestBody: createJsonRequestBody("#/components/schemas/PlaybookToggleRequest"),
      },
    },
    "/aws/playbooks/{id}/run": { post: { summary: "Run playbook manually" } },
    "/aws/playbooks/{id}": { delete: { summary: "Delete playbook" } },
    "/aws/audits": { get: { summary: "List incident audit records (AWS ops view)" } },
    "/aws/audits/{id}/note": {
      put: {
        summary: "Update incident audit note",
        requestBody: createJsonRequestBody("#/components/schemas/AuditNoteUpdateRequest"),
      },
    },
    "/aws/audits/{id}/export": {
      get: {
        summary: "Export audit report",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string" },
          },
          {
            in: "query",
            name: "format",
            required: false,
            schema: { type: "string", enum: ["txt", "json", "csv"] },
          },
        ],
      },
    },
    "/aws/metrics": { get: { summary: "Get AWS metrics bundle for dashboards" } },
    "/servers": {
      get: { summary: "List servers with pagination/filter/sort" },
      post: {
        summary: "Create server entry",
        requestBody: createJsonRequestBody("#/components/schemas/ServerCreateRequest"),
      },
    },
    "/servers/{id}": { delete: { summary: "Delete server entry" } },
    "/alerts": {
      get: { summary: "List alerts with pagination/filter/sort" },
      post: {
        summary: "Create alert",
        requestBody: createJsonRequestBody("#/components/schemas/AlertCreateRequest"),
      },
    },
    "/alerts/{id}": {
      put: {
        summary: "Update alert status",
        requestBody: createJsonRequestBody("#/components/schemas/AlertUpdateRequest"),
      },
      delete: { summary: "Delete alert" },
    },
    "/automation/rules": {
      get: { summary: "List automation rules with pagination/filter/sort" },
      post: {
        summary: "Create automation rule",
        requestBody: createJsonRequestBody("#/components/schemas/AutomationRuleCreateRequest"),
      },
    },
    "/automation/rules/{id}": {
      put: {
        summary: "Update or run automation rule",
        requestBody: createJsonRequestBody("#/components/schemas/AutomationRuleUpdateRequest"),
      },
      delete: { summary: "Delete automation rule" },
    },
    "/incidents": { get: { summary: "List incidents with pagination/filter/sort" } },
    "/incidents/rules": {
      get: { summary: "List incident detection rules" },
      post: {
        summary: "Create incident detection rule",
        requestBody: createJsonRequestBody("#/components/schemas/IncidentRuleCreateRequest"),
      },
    },
    "/incidents/rules/{id}/enabled": {
      put: {
        summary: "Enable or disable detection rule",
        requestBody: createJsonRequestBody("#/components/schemas/IncidentRuleToggleRequest"),
      },
    },
    "/incidents/rules/{id}": { delete: { summary: "Delete detection rule" } },
    "/incidents/{id}": { get: { summary: "Get incident detail" } },
    "/incidents/{id}/export": {
      get: {
        summary: "Export single incident report",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string" },
          },
          {
            in: "query",
            name: "format",
            required: false,
            schema: { type: "string", enum: ["txt", "json", "csv"] },
          },
        ],
      },
    },
    "/incidents/audit": { get: { summary: "List incident audit records" } },
    "/metrics/{metric}": { get: { summary: "Get metric series by metric and range" } },
    "/metrics/latest": { get: { summary: "Get latest metric snapshot" } },
    "/stream/metrics": { get: { summary: "SSE metrics stream" } },
    "/stream/alerts": { get: { summary: "SSE alerts stream" } },
    "/notifications/test": {
      post: {
        summary: "Send test notification",
        requestBody: createJsonRequestBody("#/components/schemas/NotificationTestRequest"),
      },
    },
    "/notifications/deliveries": { get: { summary: "List notification deliveries" } },
    "/notifications/dead-letters": { get: { summary: "List dropped notification dead letters" } },
    "/ai/anomalies": { get: { summary: "List AI anomaly signals" } },
    "/ai/predictions": { get: { summary: "Get AI forecast points" } },
    "/ai/recommendations": { get: { summary: "List AI recommendations" } },
    "/ai/recommendations/{id}": {
      put: {
        summary: "Update AI recommendation state",
        requestBody: createJsonRequestBody("#/components/schemas/AIRecommendationUpdateRequest"),
      },
    },
    "/user/profile": {
      get: { summary: "Get user settings profile" },
      put: {
        summary: "Update user settings profile",
        requestBody: createJsonRequestBody("#/components/schemas/UserProfileUpdateRequest"),
      },
    },
    "/user/password": {
      put: {
        summary: "Update account password",
        requestBody: createJsonRequestBody("#/components/schemas/UserPasswordUpdateRequest"),
      },
    },
    "/user/api-keys": {
      get: { summary: "List API keys" },
      post: {
        summary: "Create API key",
        requestBody: createJsonRequestBody("#/components/schemas/ApiKeyCreateRequest"),
      },
    },
    "/user/api-keys/{id}": { delete: { summary: "Delete API key" } },
    "/usage/me": {
      get: {
        summary: "Get current plan usage and remaining quotas",
        responses: {
          "200": createJsonResponse("Usage summary.", "#/components/schemas/UsageSnapshotResponse"),
        },
      },
    },
    "/usage/alerts": {
      get: {
        summary: "List generated quota alerts for current period",
        responses: {
          "200": createJsonResponse("Quota alerts.", "#/components/schemas/QuotaAlertsResponse"),
        },
      },
    },
    "/billing/subscription": {
      get: {
        summary: "Get current subscription state",
        responses: {
          "200": createJsonResponse(
            "Current subscription.",
            "#/components/schemas/BillingSubscriptionResponse"
          ),
        },
      },
      post: {
        summary: "Update subscription in local billing adapter",
        requestBody: createJsonRequestBody("#/components/schemas/BillingSubscriptionUpdateRequest"),
        responses: {
          "200": createJsonResponse(
            "Subscription updated.",
            "#/components/schemas/BillingSubscriptionMutationResponse"
          ),
        },
      },
    },
    "/billing/webhooks/stripe": {
      post: {
        summary: "Stripe webhook for subscription sync",
        responses: {
          "200": createJsonResponse("Webhook processed.", "#/components/schemas/BillingWebhookResponse"),
          "400": createJsonResponse("Webhook rejected.", "#/components/schemas/ErrorResponse"),
          "500": createJsonResponse("Webhook misconfiguration.", "#/components/schemas/ErrorResponse"),
        },
      },
    },
    "/tenancy/validation": {
      get: {
        summary: "Run tenant isolation validation checks",
        responses: {
          "200": createJsonResponse(
            "Tenant validation result.",
            "#/components/schemas/TenantValidationResponse"
          ),
        },
      },
    },
    "/users/me": { get: { summary: "Legacy alias for current user" } },
    "/logout": { get: { summary: "Legacy alias for logout" } },
    "/oauth/google/redirect_url": { get: { summary: "OAuth disabled endpoint" } },
    "/sessions": { post: { summary: "OAuth session exchange disabled endpoint" } },
  };

  return {
    openapi: "3.0.3",
    info: {
      title: "InfraMind AI API",
      version: apiVersion,
      description:
        "Core API surface for auth, monitoring, incidents, playbooks, settings, billing, and usage contracts.",
    },
    servers: [
      {
        url: "/api/v1",
      },
      {
        url: "/api",
      },
    ],
    tags: [
      { name: "auth" },
      { name: "workspaces" },
      { name: "aws" },
      { name: "infrastructure" },
      { name: "alerts" },
      { name: "automation" },
      { name: "incidents" },
      { name: "metrics" },
      { name: "ai" },
      { name: "settings" },
      { name: "notifications" },
      { name: "usage" },
      { name: "billing" },
      { name: "tenancy" },
      { name: "legacy" },
    ],
    paths: applyOperationDefaults(paths),
    components: {
      securitySchemes: {
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "inframind_session",
        },
      },
      schemas: {
        GenericResponse: {
          type: "object",
          additionalProperties: true,
        },
        GenericMutationRequest: {
          type: "object",
          additionalProperties: true,
        },
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
          required: ["error"],
        },
        RegisterRequest: {
          type: "object",
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            plan: { type: "string", enum: ["starter", "pro", "enterprise"] },
          },
          required: ["firstName", "lastName", "email", "password"],
        },
        RegisterResponse: {
          type: "object",
          properties: {
            user: { $ref: "#/components/schemas/AuthUser" },
            message: { type: "string" },
            welcomeEmailStatus: { type: "string", enum: ["queued", "disabled", "failed"] },
          },
          required: ["user", "message"],
        },
        LoginRequest: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
          required: ["email", "password"],
        },
        AuthUser: {
          type: "object",
          properties: {
            id: { type: "string" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string", format: "email" },
            plan: { type: "string", enum: ["starter", "pro", "enterprise"] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
          required: ["id", "firstName", "lastName", "email", "plan", "createdAt", "updatedAt"],
        },
        AuthSessionResponse: {
          type: "object",
          properties: {
            user: { $ref: "#/components/schemas/AuthUser" },
          },
          required: ["user"],
        },
        EmailRequest: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
          },
          required: ["email"],
        },
        TokenRequest: {
          type: "object",
          properties: {
            token: { type: "string" },
          },
          required: ["token"],
        },
        ResetPasswordRequest: {
          type: "object",
          properties: {
            token: { type: "string" },
            password: { type: "string", minLength: 8 },
          },
          required: ["token", "password"],
        },
        WorkspaceInviteRequest: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["owner", "admin", "engineer", "viewer"] },
          },
          required: ["email"],
        },
        AwsConfigUpdateRequest: {
          type: "object",
          additionalProperties: true,
        },
        ResourceActionRequest: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["restart", "scale", "redeploy", "failover"] },
          },
          required: ["action"],
        },
        IncidentStatusUpdateRequest: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["Detected", "Analyzing", "Recovering", "Resolved", "Escalated"],
            },
          },
          required: ["status"],
        },
        IncidentAssignmentRequest: {
          type: "object",
          properties: {
            owner: { type: "string" },
            team: { type: "string" },
          },
        },
        PlaybookCreateRequest: {
          type: "object",
          additionalProperties: true,
        },
        PlaybookToggleRequest: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
          },
          required: ["enabled"],
        },
        AuditNoteUpdateRequest: {
          type: "object",
          properties: {
            note: { type: "string" },
          },
          required: ["note"],
        },
        ServerCreateRequest: {
          type: "object",
          additionalProperties: true,
        },
        AlertCreateRequest: {
          type: "object",
          additionalProperties: true,
        },
        AlertUpdateRequest: {
          type: "object",
          additionalProperties: true,
        },
        AutomationRuleCreateRequest: {
          type: "object",
          additionalProperties: true,
        },
        AutomationRuleUpdateRequest: {
          type: "object",
          additionalProperties: true,
        },
        IncidentRuleCreateRequest: {
          type: "object",
          additionalProperties: true,
        },
        IncidentRuleToggleRequest: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
          },
          required: ["enabled"],
        },
        NotificationTestRequest: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["email", "sms", "slack", "teams"] },
            target: { type: "string" },
          },
          required: ["type", "target"],
        },
        AIRecommendationUpdateRequest: {
          type: "object",
          properties: {
            done: { type: "boolean" },
          },
          required: ["done"],
        },
        UserProfileUpdateRequest: {
          type: "object",
          additionalProperties: true,
        },
        UserPasswordUpdateRequest: {
          type: "object",
          properties: {
            currentPassword: { type: "string" },
            newPassword: { type: "string", minLength: 8 },
          },
          required: ["currentPassword", "newPassword"],
        },
        ApiKeyCreateRequest: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          required: ["name"],
        },
        BillingSubscriptionUpdateRequest: {
          type: "object",
          properties: {
            plan: { type: "string", enum: ["starter", "pro", "enterprise"] },
            status: { type: "string", enum: ["trialing", "active", "past_due", "canceled"] },
            providerCustomerId: { type: "string", nullable: true },
            providerSubscriptionId: { type: "string", nullable: true },
            renewsAt: { type: "string", nullable: true },
          },
          required: ["plan", "status"],
        },
        QuotaAlertItem: {
          type: "object",
          properties: {
            metric: { type: "string" },
            level: { type: "string", enum: ["warning", "critical"] },
            thresholdPercent: { type: "integer" },
            usage: { type: "integer" },
            limit: { type: "integer" },
            percentUsed: { type: "integer" },
          },
          required: ["metric", "level", "thresholdPercent", "usage", "limit", "percentUsed"],
        },
        UsageSnapshotResponse: {
          type: "object",
          properties: {
            period: { type: "string", example: "2026-03" },
            plan: { type: "string", enum: ["starter", "pro", "enterprise"] },
            limits: { type: "object", additionalProperties: { type: "integer" } },
            usage: { type: "object", additionalProperties: { type: "integer" } },
            remaining: { type: "object", additionalProperties: { type: "integer" } },
            quotaAlerts: {
              type: "array",
              items: { $ref: "#/components/schemas/QuotaAlertItem" },
            },
            newlyTriggeredQuotaAlerts: {
              type: "array",
              items: { $ref: "#/components/schemas/QuotaAlertItem" },
            },
          },
          required: [
            "period",
            "plan",
            "limits",
            "usage",
            "remaining",
            "quotaAlerts",
            "newlyTriggeredQuotaAlerts",
          ],
        },
        QuotaAlertsResponse: {
          type: "object",
          properties: {
            alerts: {
              type: "array",
              items: { $ref: "#/components/schemas/QuotaAlertItem" },
            },
          },
          required: ["alerts"],
        },
        BillingSubscription: {
          type: "object",
          properties: {
            plan: { type: "string", enum: ["starter", "pro", "enterprise"] },
            status: { type: "string", enum: ["trialing", "active", "past_due", "canceled"] },
            providerCustomerId: { type: "string", nullable: true },
            providerSubscriptionId: { type: "string", nullable: true },
            renewsAt: { type: "string", nullable: true },
            updatedAt: { type: "string", nullable: true },
          },
          required: ["plan", "status", "providerCustomerId", "providerSubscriptionId", "renewsAt"],
        },
        BillingSubscriptionResponse: {
          type: "object",
          properties: {
            subscription: { $ref: "#/components/schemas/BillingSubscription" },
            localOnly: { type: "boolean" },
          },
          required: ["subscription", "localOnly"],
        },
        BillingSubscriptionMutationResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            subscription: { $ref: "#/components/schemas/BillingSubscription" },
            localOnly: { type: "boolean" },
          },
          required: ["success", "subscription", "localOnly"],
        },
        BillingWebhookResponse: {
          type: "object",
          properties: {
            received: { type: "boolean" },
            synced: { type: "boolean" },
            ignored: { type: "boolean" },
            userId: { type: "string", nullable: true },
            plan: { type: "string", enum: ["starter", "pro", "enterprise"], nullable: true },
            status: { type: "string", enum: ["trialing", "active", "past_due", "canceled"], nullable: true },
            eventType: { type: "string", nullable: true },
          },
          required: ["received"],
        },
        TenantValidationViolation: {
          type: "object",
          additionalProperties: true,
        },
        TenantValidationResponse: {
          type: "object",
          properties: {
            healthy: { type: "boolean" },
            membershipsChecked: { type: "integer" },
            violations: {
              type: "array",
              items: { $ref: "#/components/schemas/TenantValidationViolation" },
            },
          },
          required: ["healthy", "membershipsChecked", "violations"],
        },
      },
    },
  };
}
