# Metropolis Satosha API

## Overview

The Metropolis Satosha API is a project designed to provide API endpoints to communicate with the Satosha Agent on AWS. This README will guide you through the contents of the project and the steps necessary to get it running.

## Project Contents

### Files and Directories

- **src/lambda.ts**: Contains the exported functions for AWS Lambda.
- **src/server.ts**: Contains the exported functions for the server setup and handling.

### Exported Functions

#### From `lambda.ts`

- `handler`: This function is the main entry point for the AWS Lambda function. It handles incoming events and processes them accordingly.

## Getting Started

### Prerequisites

- Node.js (this was developed on version 22.14.0)
- npm (version 10.9.2)

### Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/erazoerazo/metropolis-satosha-api.git
    ```
2. Navigate to the project directory:
    ```sh
    cd metropolis-satosha-api
    ```
3. Install the dependencies:
    ```sh
    npm install
    ```

### Running the Project

To start the server, run:
```sh
npm start
```

### Deployment

To deploy the Lambda function, follow the [AWS Lambda deployment instructions](https://docs.aws.amazon.com/lambda/latest/dg/configuration-function-zip.html) provided in the AWS documentation.

## Contact

For any questions or issues, please open an issue on GitHub or contact a.erazo@beanar.io
