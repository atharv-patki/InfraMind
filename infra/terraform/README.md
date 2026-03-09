# InfraMind Terraform Skeleton

This folder is a starter template for production IaC.

## Planned Resources
- EventBridge bus and rules
- Lambda functions for ingestion and auto-recovery
- SQS queue + DLQ
- SNS topics for notifications
- IAM roles and policies for least-privilege execution
- CloudWatch dashboards and alarms

## Usage
1. Copy `terraform.tfvars.example` to `terraform.tfvars`.
2. Fill AWS account and region values.
3. Run:
   - `terraform init`
   - `terraform plan`
   - `terraform apply`
