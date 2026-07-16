#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SecretsStack } from '../lib/secrets-stack';
import { LambdaStack } from '../lib/lambda-stack';
import { ApiGatewayStack } from '../lib/api-gateway-stack';
import { BudgetStack } from '../lib/budget-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// Set for real before deploying: the deployed frontend's origin (e.g.
// https://roadtrip-planner.vercel.app) and an email to receive AWS budget
// alerts. Defaults here are placeholders, not meant to be deployed as-is.
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? 'http://localhost:3000';
const budgetAlertEmail = process.env.BUDGET_ALERT_EMAIL ?? 'CHANGE_ME@example.com';

const secretsStack = new SecretsStack(app, 'RoadtripSecretsStack', { env });

const lambdaStack = new LambdaStack(app, 'RoadtripLambdaStack', {
  env,
  allowedOrigin,
  databaseUrlSecret: secretsStack.databaseUrlSecret,
  googlePlacesApiKeySecret: secretsStack.googlePlacesApiKeySecret,
});

new ApiGatewayStack(app, 'RoadtripApiGatewayStack', {
  env,
  handler: lambdaStack.handler,
  allowedOrigin,
});

new BudgetStack(app, 'RoadtripBudgetStack', {
  env,
  alertEmail: budgetAlertEmail,
});
