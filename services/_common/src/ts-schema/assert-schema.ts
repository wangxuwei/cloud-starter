import { Project } from '#shared/entities.js';
import Ajv from "ajv";
import generated_schema from './generated_schemas.js';

const ajv = new Ajv({ allErrors: true });
ajv.addSchema(generated_schema);

export function assertProject(obj: any): asserts obj is Project {
  const type = 'Project';
  try {
    const valid = ajv.validate(`#/definitions/${type}`, obj);
    console.log('->> assertProject ', obj, valid, ajv.errors);

  } catch (ex: any) {

    console.log(`ASSERT TYPE '${type} failed.`, ex);
    throw Error(`ASSERT TYPE '${type} failed ${ex}`)
  }


}