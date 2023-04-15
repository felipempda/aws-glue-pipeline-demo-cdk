import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';

export interface ImportFileStackProps extends cdk.StackProps {
  bucketStage: Bucket
}

export class ImportFileStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ImportFileStackProps) {
    super(scope, id, props);

  // trigger deploy
    new BucketDeployment(this, 'DeployCSV', {
      sources: [Source.asset('./source-data')], 
      destinationBucket: props.bucketStage,
    });
  }
}