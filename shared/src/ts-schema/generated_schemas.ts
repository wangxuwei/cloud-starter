
// GENERATED FILE

// DO NOT EDIT MANUALLY   (use 'npm run ts-schema' or edit /scripts/cmd-ts-schema.ts)
const generated_schemas = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "Project": {
      "description": "Project entity model when read from the DAO\ntable name: 'project'",
      "type": "object",
      "properties": {
        "id": {
          "minimum": 123,
          "type": "number"
        },
        "uuid": {
          "type": "string"
        },
        "orgId": {
          "type": "number"
        },
        "wksId": {
          "type": "number"
        },
        "name": {
          "type": "string"
        },
        "desc": {
          "type": "string"
        },
        "cid": {
          "type": "number"
        },
        "ctime": {
          "type": "string"
        },
        "mid": {
          "type": "number"
        },
        "mtime": {
          "type": "string"
        }
      },
      "required": [
        "id",
        "name",
        "orgId",
        "uuid"
      ]
    }
  }
}

// DO NOT IMPORT DIRECTLY (use 'import { getSchema } from "#common/ts-schema/index.js"')
export default generated_schemas;
