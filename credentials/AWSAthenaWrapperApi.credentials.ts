import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class AWSAthenaWrapperApi implements ICredentialType {
	name = 'awsAthenaWrapperCredentialsApi';
	displayName = 'AWS Athena Credentials API';
	properties: INodeProperties[] = [
		// The credentials to get from user and save encrypted.
		// Properties can be defined exactly in the same way
		// as node properties.
		{
			displayName: 'Access Key Id',
			name: 'accessKeyId',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Secret Access Key',
			name: 'secretAccessKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
		},
		{
			displayName: 'Token',
			name: 'tokenKey',
			type: 'string',
			default: '',
		},
		{
			displayName: 'S3',
			name: 's3OutputLocation',
			type: 'string',
			default: '',
		}
	];
}
