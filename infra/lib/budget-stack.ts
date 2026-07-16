import * as cdk from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import { Construct } from 'constructs';

export interface BudgetStackProps extends cdk.StackProps {
  alertEmail: string;
  monthlyLimitUsd?: number;
}

/**
 * A billing alarm as cheap insurance -- expected actual cost is ~$0-2/mo at
 * portfolio-demo traffic (see plan doc), so this threshold is generously
 * above that, purely to catch something going wrong (a runaway loop, a
 * scraping bot hammering the Places-backed endpoint, etc).
 */
export class BudgetStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BudgetStackProps) {
    super(scope, id, props);

    const limit = props.monthlyLimitUsd ?? 15;

    new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: {
          amount: limit,
          unit: 'USD',
        },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 80,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [
            {
              subscriptionType: 'EMAIL',
              address: props.alertEmail,
            },
          ],
        },
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 100,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [
            {
              subscriptionType: 'EMAIL',
              address: props.alertEmail,
            },
          ],
        },
      ],
    });
  }
}
