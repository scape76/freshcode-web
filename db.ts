import {Database} from 'bun:sqlite'

const db = new Database("contacts.sqlite");

export {db};