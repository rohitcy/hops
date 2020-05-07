const { join } = require('path');
const { RawSource } = require('webpack-sources');
const { trimTrailingSlash } = require('pathifist');

const analyzeCompilation = ({ chunks, chunkGroups }) => {
  const entryChunks = chunks.filter(({ entryModule }) => !!entryModule);
  const vendorChunks = chunkGroups.reduce(
    (result, { chunks }) => [
      ...result,
      ...(chunks.find((chunk) => entryChunks.includes(chunk))
        ? chunks.filter((chunk) => !entryChunks.includes(chunk))
        : []),
    ],
    []
  );

  const chunksByModule = chunks.reduce(
    (result, chunk) =>
      Array.from(chunk.modulesIterable).reduce((result, module) => {
        const { chunks } = chunkGroups.find(({ chunks }) =>
          chunks.includes(chunk)
        );
        return [...result, [module.id, chunks]];
      }, result),
    []
  );

  return { entryChunks, vendorChunks, chunksByModule };
};

const extractFiles = (chunkData, rawPublicPath) => {
  const publicPath = trimTrailingSlash(rawPublicPath);
  const { entryChunks, vendorChunks, chunksByModule } = chunkData;
  const gatherFiles = (result, { files }) => [
    ...result,
    ...files.map((file) => `${publicPath}/${file}`),
  ];

  return {
    entryFiles: entryChunks.reduce(gatherFiles, []),
    vendorFiles: vendorChunks.reduce(gatherFiles, []),
    moduleFileMap: chunksByModule.reduce((result, [module, chunks]) => {
      result[module] = chunks.reduce(gatherFiles, []);
      return result;
    }, {}),
  };
};

exports.StatsPlugin = class StatsPlugin {
  constructor(enhancedPromise, { statsFile, serverDir }) {
    this.apply = (compiler) => {
      compiler.hooks.compilation.tap('StatsPlugin', (compilation) => {
        compilation.hooks.additionalAssets.tap('StatsPlugin', () => {
          const { publicPath } = compilation.outputOptions;

          if (compilation.compiler.isChild()) {
            return;
          }

          const stats = extractFiles(
            analyzeCompilation(compilation),
            publicPath
          );

          compilation.assets[join(serverDir, statsFile)] = new RawSource(
            JSON.stringify({
              ...compilation
                .getStats()
                .toJson({ all: false, assets: true, entrypoints: true }),
              ...stats,
            })
          );
        });
      });
    };
  }
};

exports.StatsFilePlugin = class StatsFilePlugin {
  constructor(enhancedPromise, { statsFile }) {
    this.apply = (compiler) => {
      compiler.hooks.compilation.tap('StatsFilePlugin', (compilation) =>
        compilation.hooks.additionalAssets.tapPromise('StatsFilePlugin', () =>
          enhancedPromise.then(
            (stats) =>
              (compilation.assets[statsFile] = new RawSource(
                JSON.stringify(stats)
              ))
          )
        )
      );
    };
  }
};
