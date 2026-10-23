const fs = require("fs/promises");
const path = require("path");

const stateFile = process.env.PLATFORM_DATA_FILE
  ? path.resolve(process.env.PLATFORM_DATA_FILE)
  : path.resolve(__dirname, "..", "data", "platform.json");
let writeQueue = Promise.resolve();

function normalize(state = {}) {
  state.apps ||= {};
  state.carts ||= {};
  state.payments ||= {};
  state.renewals ||= {};
  state.sessions ||= {};
  state.notifications ||= {};
  state.auditLogs ||= [];
  state.incidents ||= [];
  state.statusChecks ||= [];
  state.users ||= {};
  return state;
}

async function readState() {
  try {
    return normalize(JSON.parse(await fs.readFile(stateFile, "utf8")));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return normalize({});
  }
}

async function writeState(state) {
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  const temporary = `${stateFile}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(
    temporary,
    JSON.stringify(normalize(state), null, 2),
    "utf8",
  );
  await fs.rename(temporary, stateFile);
}

function mutateState(mutator) {
  const operation = writeQueue.then(async () => {
    const state = await readState();
    const result = await mutator(state);
    await writeState(state);
    return result;
  });
  writeQueue = operation.catch(() => {});
  return operation;
}

module.exports = { mutateState, readState, writeState };
