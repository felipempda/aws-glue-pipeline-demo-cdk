#!/bin/bash 
# you may find the Deployment Stack a little bit too slow for testint
# you use a simple script that will do the deploy instead, specailly during tests:
bucket=<your stage bucket>
aws s3 rm s3://$bucket/data.csv
aws s3 cp source-data/* s3://$bucket/data.csv