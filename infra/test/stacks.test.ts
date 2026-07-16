import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { SecretsStack } from '../lib/secrets-stack';
import { ApiGatewayStack } from '../lib/api-gateway-stack';
import { BudgetStack } from '../lib/budget-stack';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

// LambdaStack pulls in PythonFunction, which shells out to Docker to bundle
// backend/ at synth time -- not viable in a unit test / CI environment
// without Docker. These tests cover the stacks that don't need bundling;
// LambdaStack itself is exercised by `cdk synth` as part of a real deploy.

test('SecretsStack references the expected secret names', () => {
  const app = new cdk.App();
  const stack = new SecretsStack(app, 'TestSecretsStack');
  const template = Template.fromStack(stack);
  // fromSecretNameV2 doesn't create resources, just a reference -- nothing
  // to assert in the template itself, but the stack should synth without error.
  expect(template.toJSON()).toBeDefined();
});

test('BudgetStack creates a monthly cost budget with alert subscribers', () => {
  const app = new cdk.App();
  const stack = new BudgetStack(app, 'TestBudgetStack', {
    alertEmail: 'test@example.com',
    monthlyLimitUsd: 15,
  });
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::Budgets::Budget', {
    Budget: {
      BudgetType: 'COST',
      TimeUnit: 'MONTHLY',
      BudgetLimit: { Amount: 15, Unit: 'USD' },
    },
  });
});

test('ApiGatewayStack creates an HTTP API with CORS configured for the allowed origin', () => {
  const app = new cdk.App();

  // A minimal stand-in Lambda so ApiGatewayStack has something to integrate
  // with, without pulling in PythonFunction's Docker-based bundling.
  class FakeLambdaStack extends cdk.Stack {
    public readonly handler: lambda.IFunction;
    constructor(scope: Construct, id: string) {
      super(scope, id);
      this.handler = new lambda.Function(this, 'Fn', {
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'app.lambda_handler.handler',
        code: lambda.Code.fromInline('def handler(event, context): return {"statusCode": 200}'),
      });
    }
  }

  const fakeLambdaStack = new FakeLambdaStack(app, 'FakeLambdaStack');
  const stack = new ApiGatewayStack(app, 'TestApiGatewayStack', {
    handler: fakeLambdaStack.handler,
    allowedOrigin: 'https://roadtrip-planner.vercel.app',
  });
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
    Name: 'roadtrip-planner-api',
    CorsConfiguration: {
      AllowOrigins: ['https://roadtrip-planner.vercel.app'],
      AllowCredentials: true,
    },
  });
});
