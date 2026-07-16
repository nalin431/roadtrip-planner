import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
import { Construct } from 'constructs';
import * as path from 'path';

export interface LambdaStackProps extends cdk.StackProps {
  allowedOrigin: string;
  databaseUrlSecret: secretsmanager.ISecret;
  googlePlacesApiKeySecret: secretsmanager.ISecret;
}

export class LambdaStack extends cdk.Stack {
  public readonly handler: PythonFunction;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    // Minimal execution role: CloudWatch Logs write access (via the managed
    // basic execution policy) plus read access to exactly the two secrets
    // this function needs -- not a broad managed policy.
    const executionRole = new iam.Role(this, 'ExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });
    props.databaseUrlSecret.grantRead(executionRole);
    props.googlePlacesApiKeySecret.grantRead(executionRole);

    this.handler = new PythonFunction(this, 'ApiHandler', {
      entry: path.join(__dirname, '..', '..', 'backend'),
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.ARM_64, // Graviton, better price-performance
      index: 'app/lambda_handler.py',
      handler: 'handler',
      role: executionRole,
      memorySize: 512,
      timeout: cdk.Duration.seconds(29), // matches API Gateway's HTTP API integration timeout
      logGroup: new logs.LogGroup(this, 'ApiHandlerLogGroup', {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      environment: {
        APP_ENV: 'lambda',
        ALLOWED_ORIGIN: props.allowedOrigin,
        // secretValue.toString() emits a CloudFormation dynamic reference
        // ( {{resolve:secretsmanager:...}} ), not the literal secret value --
        // the actual value is resolved by the Lambda service at deploy time
        // and never appears in the template, console, or CDK output.
        DATABASE_URL: props.databaseUrlSecret.secretValue.toString(),
        GOOGLE_PLACES_API_KEY: props.googlePlacesApiKeySecret.secretValue.toString(),
      },
    });
  }
}
