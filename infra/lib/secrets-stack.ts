import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

/**
 * References existing Secrets Manager entries -- the actual secret *values*
 * are set once via CLI/console (see infra/README.md), not stored in CDK/git.
 * This stack's job is just to make those secrets' ARNs available to
 * LambdaStack for env wiring + IAM read grants.
 */
export class SecretsStack extends cdk.Stack {
  public readonly databaseUrlSecret: secretsmanager.ISecret;
  public readonly googlePlacesApiKeySecret: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.databaseUrlSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'DatabaseUrlSecret',
      'roadtrip-planner/database-url'
    );

    this.googlePlacesApiKeySecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'GooglePlacesApiKeySecret',
      'roadtrip-planner/google-places-api-key'
    );
  }
}
