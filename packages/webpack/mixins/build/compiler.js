const { fork } = require('child_process');
const webpack = require('webpack');
const { serializeError } = require('serialize-error');
const { configure } = require('../../');
const { BuildError, CompilerError } = require('../../lib/utils/errors');

function createChildCompiler(buildConfigArgs, options, overrides) {
  const child = fork(__filename);

  process.on('exit', () => child.kill());

  child.send({
    name: 'build',
    buildConfigArgs,
    overrides,
    options,
  });

  return new Promise((resolve, reject) => {
    child.on('message', ({ type, data, reason }) => {
      if (type === 'reject') {
        reject(
          typeof reason === 'string'
            ? new BuildError(reason)
            : new CompilerError(reason)
        );
      } else if (type === 'resolve') {
        resolve(data);
      }

      child.kill();
    });
  });
}
exports.createChildCompiler = createChildCompiler;

process.on('message', (message) => {
  if (message.name !== 'build') return;

  const { buildConfigArgs, overrides, options } = message;
  const webpackConfig = configure(overrides, options).getBuildConfig(
    ...buildConfigArgs
  );

  try {
    const compiler = webpack(webpackConfig);

    compiler.run((compileError, stats) => {
      if (compileError) {
        process.send({
          type: 'reject',
          reason: new CompilerError(compileError),
        });
      } else if (stats.hasErrors()) {
        process.send({
          type: 'reject',
          reason: new BuildError(
            stats.toJson({ all: false, errors: true }).errors.shift()
          ),
        });
      } else {
        process.send({ type: 'resolve', data: stats.toString({ chunks: false, modules: false, entrypoints: false }) });
      }
    });
  } catch (error) {
    process.send({
      type: 'reject',
      reason: serializeError(error),
    });
  }
});
