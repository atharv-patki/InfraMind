terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

locals {
  app_name = "inframind-ai"
  tags = {
    app         = local.app_name
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "aws_sqs_queue" "incident_events_dlq" {
  name = "${local.app_name}-${var.environment}-incident-events-dlq"
  tags = local.tags
}

resource "aws_sqs_queue" "incident_events" {
  name = "${local.app_name}-${var.environment}-incident-events"

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.incident_events_dlq.arn
    maxReceiveCount     = 5
  })

  tags = local.tags
}

resource "aws_sns_topic" "incident_alerts" {
  name = "${local.app_name}-${var.environment}-incident-alerts"
  tags = local.tags
}

resource "aws_cloudwatch_event_bus" "ops_bus" {
  name = "${local.app_name}-${var.environment}-ops-bus"
  tags = local.tags
}
