import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket, EventType } from 'aws-cdk-lib/aws-s3';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { SqsDestination } from 'aws-cdk-lib/aws-s3-notifications'

export interface StageStackProps extends cdk.StackProps {
  importFile?: boolean
}

export class StageStack extends cdk.Stack {
  public readonly bucket: Bucket;
  public readonly sqsQueue: Queue;
  constructor(scope: Construct, id: string, props?: StageStackProps) {
    super(scope, id, props);

   // create bucket
   this.bucket = new Bucket (this, 'BucketStaging', {
    autoDeleteObjects: true,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    eventBridgeEnabled: true
   } )

   // sqs notification
   this.sqsQueue = new Queue(this, 'GlueQueue' , {})
   this.bucket.addEventNotification( EventType.OBJECT_CREATED, new SqsDestination(this.sqsQueue))

  }
}