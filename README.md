## Description

[DayOnes.io](https://github.com/hakeemsyd/daysone-backend.git) Backend repository

## Project setup

```bash
$ yarn install
```

## Compile and run the project

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Migrations

### Production: To generate / run / revert a migration, make build first

```bash
yarn build
```

### Generate a migration from existing table schema <br />

Automatic migration generation creates a new migration file and writes all sql queries that must be executed to update the database

```bash
TableName=<name> yarn migration:generate
```

### Run migrations <br />

To execute all pending migrations use following command:

To run a migration on local / development

```bash
yarn local-migration:run
```
To run a migration on production
```bash
yarn prod-migration:run
```

### Revert migrations <br />

To revert the most recently executed migration use the following command:

To revert a migration on local / development

```bash
yarn local-migration:revert
```
To revert a migration on production

```bash
yarn prod-migration:revert
```

### Show migrations <br />

To show all migrations and whether they've been run or not use following command:

To show migrations on local / development

```bash
yarn local-migration:show
```
To show migrations on production

```bash
yarn prod-migration:show
```
