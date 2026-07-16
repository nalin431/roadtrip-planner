import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface ApiGatewayStackProps extends cdk.StackProps {
  handler: lambda.IFunction;
  allowedOrigin: string;
}

export class ApiGatewayStack extends cdk.Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    const integration = new integrations.HttpLambdaIntegration('ApiIntegration', props.handler);

    // HTTP API (not REST API) -- cheaper, simpler, sufficient here. CORS is
    // also handled by the FastAPI app's own CORSMiddleware; this is a second,
    // redundant layer at the gateway so preflight OPTIONS requests that never
    // reach the Lambda still get a correct response.
    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'roadtrip-planner-api',
      corsPreflight: {
        allowOrigins: [props.allowedOrigin],
        allowCredentials: true,
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type'],
      },
      defaultIntegration: integration,
    });

    this.apiUrl = httpApi.apiEndpoint;

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.apiEndpoint,
      description: 'API Gateway base URL -- set as NEXT_PUBLIC_API_BASE_URL on the frontend',
    });
  }
}
