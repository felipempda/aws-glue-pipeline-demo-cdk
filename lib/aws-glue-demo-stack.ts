import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Database } from '@aws-cdk/aws-glue-alpha'; // L2 experimental
import { CfnCrawler, CfnJob, CfnTrigger, CfnWorkflow } from 'aws-cdk-lib/aws-glue';
import { Role, ServicePrincipal, ManagedPolicy, PolicyStatement, PolicyDocument } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { CfnRule } from 'aws-cdk-lib/aws-events';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';

export interface AwsGlueDemoStackProps extends cdk.StackProps {
  bucketStage: Bucket,
  sqsQueue: Queue
}

export class AwsGlueDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: AwsGlueDemoStackProps) {
    super(scope, id, props);

    // create role for service glue
    const roleGlue = new Role(this, "RoleGlue", {
      assumedBy: new ServicePrincipal("glue.amazonaws.com")
    });

    // add permission to role
    roleGlue.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSGlueServiceRole"))
    roleGlue.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"))
    roleGlue.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("AmazonSQSFullAccess"))
    roleGlue.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("CloudWatchEventsFullAccess"))
    roleGlue.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("AWSCloudTrail_ReadOnlyAccess"))

    // database
    const database = new Database(this, 'GlueDatabase', {
      databaseName: "gluedatabase"
    });

    // crawler
    const crawler = new CfnCrawler(this, 'GlueCrawler',
      {
        name: 'GlueCrawler',
        role: roleGlue.roleArn,
        description: 'mycrawler',
        databaseName: database.databaseName,
        targets: {
          s3Targets: [
            { path: `s3://${props?.bucketStage.bucketName}`, eventQueueArn: props?.sqsQueue.queueArn }
          ]
        },
        recrawlPolicy: { recrawlBehavior: 'CRAWL_EVENT_MODE' }
      });

    // s3 for scripts
    const bucketScripts = new Bucket(this, 'BucketScript', {
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    // deploy job script
    const deployScript = new BucketDeployment(this, 'DeployScript', {
      destinationBucket: bucketScripts,
      sources: [Source.asset('./job')]
    })

    // glue job
    const glueJob = new CfnJob(this, 'GlueJob', {
      role: roleGlue.roleArn,
      name: 'job-demo',
      command: {
        name: 'pythonshell',
        pythonVersion: '3.9',
        scriptLocation: `s3://${bucketScripts.bucketName}/job-demo.py`,
      },
      glueVersion: '3.0',
      defaultArguments: { '--BUCKET_S3_DEST': `${props?.bucketStage.bucketName}` },
      timeout: 2
    })

    // crawller workflow
    const glueWorkflow = new CfnWorkflow(this, 'GlueWorkflow', {
      description: "Workflow automatic demo",
      name: 'GlueWorflow'
    });

    // trigger for job:
    const triggerJob = new CfnTrigger(this, 'JobTrigger', {
      name: 'job_trigger',
      actions: [
        {
          jobName: glueJob.name,
          notificationProperty: {
            notifyDelayAfter: 1
          },
          timeout: 1
        }
      ],
      type: 'CONDITIONAL',
      startOnCreation: true,
      workflowName: glueWorkflow.name,
      predicate: {
        conditions: [
          {
            crawlerName: crawler.name,
            logicalOperator: 'EQUALS',
            crawlState: 'SUCCEEDED'
          }
        ]
      }
    })

    // trigger for the crawler
    const triggerCrawller = new CfnTrigger(this, 'CrawlerTrigger', {
      name: 'crawler_trigger',
      actions: [
        {
          crawlerName: crawler.name,
          notificationProperty: {
            notifyDelayAfter: 1
          },
          timeout: 1
        }
      ],
      type: 'EVENT',
      workflowName: glueWorkflow.name
    });
    triggerCrawller._addResourceDependency(crawler)

    // role for EventBridge Rule
    const roleEventBridgeRule = new Role(this, 'roleEventBridge', {
      assumedBy: new ServicePrincipal('events.amazonaws.com'),
      inlinePolicies: {
        eventPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: ["events:*", "glue:*"]
            })]
        })
      }
    })

    // EventBridge Rule
    const rule = new CfnRule(this, 'EventRuleGlue', {
      roleArn: roleEventBridgeRule.roleArn,
      targets: [
        {
          arn: `arn:aws:glue:${this.region}:${this.account}:workflow/${glueWorkflow.name}`,
          id: cdk.Aws.ACCOUNT_ID,
          roleArn: roleEventBridgeRule.roleArn
        }],
      eventPattern: {
        "detail-type": ["Object Created"],
        "detail": {
          "bucket": { "name": [`${props?.bucketStage.bucketName}`] }
        },
        "source": ["aws.s3"]
      }
    })

    // destination bucket:
    const destBucket = new Bucket(this, 'destBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    })

    new cdk.CfnOutput(this, 'destBucketARN', {
      value: destBucket.bucketArn
    })
  }


}
