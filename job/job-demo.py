import io
import os
import sys
import json
import boto3
import urllib3
import datetime
import pandas as pd
import awswrangler as wr
from awsglue.utils import getResolvedOptions


class Utils:
    def __init__(self):
        # Create connections
        self.s3_client = boto3.client('s3')
        self.glue_client = boto3.client('glue')
        self.event_client = boto3.client('cloudtrail')

    def get_data_from_s3(self):
        # Get event ID
        self.args = getResolvedOptions(sys.argv, ['WORKFLOW_NAME', 'WORKFLOW_RUN_ID', 'BUCKET_S3_DEST'])
        self.event_id = self.glue_client.get_workflow_run_properties(Name=self.args['WORKFLOW_NAME'],
                                                                     RunId=self.args['WORKFLOW_RUN_ID'])[
                            'RunProperties'][
                            'aws:eventIds'][1:-1]
        self.bucket_s3_dest = self.args['BUCKET_S3_DEST']
        # Get all NotifyEvent events for the last five minutes
        response = self.event_client.lookup_events(LookupAttributes=[{'AttributeKey': 'EventName',
                                                                      'AttributeValue': 'NotifyEvent'}],
                                                   StartTime=(datetime.datetime.now() - datetime.timedelta(minutes=5)),
                                                   EndTime=datetime.datetime.now())['Events']
        # Get the file name from event
        for i in range(len(response)):
            event_payload = json.loads(response[i]['CloudTrailEvent'])['requestParameters']['eventPayload']
            if event_payload['eventId'] == self.event_id:
                self.object_key = json.loads(event_payload['eventBody'])['detail']['object']['key']
                self.bucket_name = json.loads(event_payload['eventBody'])['detail']['bucket']['name']
        obj = self.s3_client.get_object(Bucket=self.bucket_name, Key=self.object_key)

        return pd.read_csv(io.BytesIO(obj['Body'].read()))


# Get file from S3
utils = Utils()
my_data = utils.get_data_from_s3()

# Remote null values
my_data.dropna()
 
# Save modified file
wr.s3.to_parquet(df=my_data, path=f's3://{utils.bucket_s3_dest}/data.parquet')