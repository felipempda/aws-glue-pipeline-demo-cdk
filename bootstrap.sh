#!/bin/bash
# call cdk bootstrap with customized parameters
# update cdk.json with choosen boostrap name

# For more information: https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html
qualifier=${1:-"teststack"}

# Update cdk.json bootstrap to choosen qualifier name:
key='"@aws-cdk/core:bootstrapQualifier"'
sed -i "s!$key: .*!$key: \"$qualifier\",!g" cdk.json

# call cdk boostrap
cdk bootstrap --qualifier "$qualifier" --toolkit-stack-name cdk-$qualifier-toolkit

