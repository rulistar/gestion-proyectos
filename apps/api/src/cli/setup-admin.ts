import { createInterface } from 'node:readline/promises';
import { loadEnv } from '../config/env.js';
import { createDb } from '../db/client.js';
import {
  createFirstAdmin,
  FIRST_WORKSPACE_NAME,
  hasAnyUser,
  SetupError,
} from '../modules/setup/first-admin.js';

/**
 * Comando de instalación (TEC-07): `pnpm --filter @gestion/api setup:admin`.
 * Pide los datos de forma interactiva para que la contraseña no quede en el historial
 * de la terminal (como pasaría con un argumento) ni se vea en pantalla.
 */

/** Lee una línea sin mostrarla: cada carácter se ve como "*" */
function askHidden(question: string): Promise<string> {
  const { stdin, stdout } = process;
  return new Promise((resolve, reject) => {
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();

    let value = '';
    const finish = (error?: Error) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') return finish();
        if (char === '\u0003') return finish(new SetupError('Cancelado.')); // Ctrl+C
        if (char === '\u007f' || char === '\b') {
          if (value) {
            value = value.slice(0, -1);
            stdout.write('\b \b');
          }
        } else if (char >= ' ') {
          value += char;
          stdout.write('*');
        }
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  if (!process.stdin.isTTY) {
    throw new SetupError('Ejecuta este comando en una terminal interactiva.');
  }

  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  try {
    // Se comprueba antes de pedir datos, para no hacer escribir la contraseña en vano
    if (await hasAnyUser(db)) {
      throw new SetupError('Ya existe al menos un usuario: el primer Admin ya fue creado.');
    }

    console.log('Crear el primer administrador\n');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const name = await rl.question('Nombre: ');
    const email = await rl.question('Correo: ');
    rl.close();

    const password = await askHidden('Contraseña (mínimo 12 caracteres): ');
    const confirmation = await askHidden('Repite la contraseña: ');
    if (password !== confirmation) {
      throw new SetupError('Las contraseñas no coinciden.');
    }

    const { user } = await createFirstAdmin(db, { name, email, password });
    console.log(
      `\n✔ Administrador ${user.email} creado, con el workspace "${FIRST_WORKSPACE_NAME}".`,
    );
  } finally {
    await db.$disconnect();
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof SetupError) {
    console.error(`\n✖ ${error.message}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
