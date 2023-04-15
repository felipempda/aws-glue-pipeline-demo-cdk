#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import * as fs from 'fs';
import { AwsGlueDemoStack } from '../lib/aws-glue-demo-stack';
import { ImportFileStack } from '../lib/import-file-stack';
import { StageStack } from '../lib/stage-stack';

const env = { account: process.env.CDK_DEFAULT_ACCOUNT || process.env.CDK_DEPLOY_ACCOUNT, 
              region:  process.env.CDK_DEFAULT_REGION  || process.env.CDK_DEPLOY_REGION}
// app
const app = new cdk.App();

// prefix to all stats: qualifier
const qualifier = JSON.parse(fs.readFileSync('cdk.json','utf8'))["context"]["@aws-cdk/core:bootstrapQualifier"]
console.log(`qualifier: ${qualifier}`)

// 1. stack to create stage bucket with event notification
const stackStage = new StageStack(app, `${qualifier}-StageStack`, {
  env: env
});

// 2. stack to create glue pipeline
const stackGlue = new AwsGlueDemoStack(app, `${qualifier}-AwsGlueDemoStack`, {
  env: env,
  bucketStage: stackStage.bucket,
  sqsQueue: stackStage.sqsQueue
});

// 3. stage to simulate data input into stage
const stackImport = new ImportFileStack(app, `${qualifier}-ImportFileStack`, {
  env: env,
  bucketStage: stackStage.bucket
});
