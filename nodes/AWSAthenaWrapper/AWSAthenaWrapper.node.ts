import * as awsSdkClients from 'aws-sdk/clients/all';
import Athena from 'aws-sdk/clients/athena';
import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class AWSAthenaWrapper implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AWS Athena',
		name: 'AWSAthenaWrapper',
		icon: 'file:awssdkwapper.svg',
		group: ['transform'],
		version: 1,
		description:
			'AWS Athena.',
		defaults: {
			name: 'AWS Athena',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'awsAthenaWrapperCredentialsApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Database Name',
				name: 'database',
				type: 'string',
				default: '',
				placeholder: 'Database name',
			},
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				default: '',
				noDataExpression: true,
				required: true,
				typeOptions: {
					editor: 'sqlEditor',
				},
			},
		],
	};


	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const inputItems = this.getInputData();

		const resultItems: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex++) {
			try {
				// Retrieve node parameters
				const query = this.getNodeParameter('query', itemIndex) as string;
				const database = this.getNodeParameter('database', itemIndex) as string;
				const credentials = await this.getCredentials('awsAthenaWrapperCredentialsApi');

				// Validate credentials
				if (
					!credentials.accessKeyId ||
					!credentials.secretAccessKey
				) {
					throw new NodeOperationError(
						this.getNode(),
						'Credenciais inválidas. Certifique-se de configurá-las corretamente.',
					);
				}

				// AWS Athena client configuration
				const athena = new awsSdkClients.Athena(credentials.tokenKey ? {
					region: 'us-east-1',
					credentials: {
						accessKeyId: credentials.accessKeyId.toString(),
						secretAccessKey: credentials.secretAccessKey.toString(),
						sessionToken: credentials.tokenKey.toString(),
					},
				} : {
					region: 'us-east-1',
					credentials: {
						accessKeyId: credentials.accessKeyId.toString(),
						secretAccessKey: credentials.secretAccessKey.toString(),
					},
				});

		const startQueryResponse = await athena
    .startQueryExecution(
        database
            ? {
                  QueryString: query,
                  QueryExecutionContext: {
                      Database: database,
                  },
                  ResultConfiguration: {
                      OutputLocation: credentials.s3OutputLocation as string, // Confirme que é uma string
                  },
              } as Athena.StartQueryExecutionInput
            : {
                  QueryString: query,
                  ResultConfiguration: {
                      OutputLocation: credentials.s3OutputLocation as string, // Confirme que é uma string
                  },
              } as Athena.StartQueryExecutionInput
    )
    .promise();

				const queryExecutionId = startQueryResponse.QueryExecutionId;
				if (!queryExecutionId) {
					throw new NodeOperationError(this.getNode(), 'Falha ao iniciar a consulta no Athena.');
				}

				// Wait for query execution to complete
				let queryExecutionStatus = 'RUNNING';
				while (queryExecutionStatus === 'RUNNING' || queryExecutionStatus === 'QUEUED') {
					await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

					const queryExecution = await athena
						.getQueryExecution({ QueryExecutionId: queryExecutionId })
						.promise();

					queryExecutionStatus = queryExecution.QueryExecution?.Status?.State || 'FAILED';

					if (queryExecutionStatus === 'FAILED' || queryExecutionStatus === 'CANCELLED') {
						throw new NodeOperationError(
							this.getNode(),
							`Consulta falhou ou foi cancelada: ${queryExecution.QueryExecution?.Status?.StateChangeReason}`,
						);
					}
				}

				// Retrieve query results
				const queryResults = await athena
					.getQueryResults({ QueryExecutionId: queryExecutionId })
					.promise();

				const rows = queryResults.ResultSet?.Rows || [];
				const columns = rows[0]?.Data?.map((data) => data.VarCharValue) || [];
				const parsedResults = rows.slice(1).map((row) => {
					const rowData = row.Data || [];
					const parsedRow: { [key: string]: string } = {};
					columns.forEach((column, index) => {
						if (column !== undefined) {
							parsedRow[column] = rowData[index]?.VarCharValue || '';
						}
					});
					return parsedRow;
				});


				// Add results to output
				parsedResults.forEach((parsedRow) => {
					resultItems.push({ json: parsedRow });
				});
				} catch (error: any) {
				console.error(error);

				if (this.continueOnFail()) {
					resultItems.push({
						json: this.getInputData(itemIndex)[0].json,
						error,
						pairedItem: itemIndex,
					});
				} else {
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		// Return processed data
		return this.prepareOutputData(resultItems);
	}

}
