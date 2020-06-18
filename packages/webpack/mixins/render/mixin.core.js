const { existsSync: exists } = require('fs');
const { join } = require('path');
const { async } = require('mixinable');
const { join: joinUrl, ensureLeadingSlash } = require('pathifist');
const { Mixin, internal: bootstrap } = require('hops-bootstrap');

const { override } = async;
const { validate, invariant } = bootstrap;

class WebpackRenderMixin extends Mixin {
  getRenderRequests() {
    const { locations, basePath } = this.config;

    return locations.map((location) => {
      const isString = typeof location === 'string';
      const url = ensureLeadingSlash(
        joinUrl(basePath, isString ? location : location.url)
      );

      return isString ? { url } : { ...location, url };
    });
  }

  configureBuild(webpackConfig, loaderConfigs, target) {
    if (target === 'build' && this.options.static) {
      const { plugins } = webpackConfig;
      const { RenderPlugin } = require('../../lib/plugins/render');

      plugins.push(
        new RenderPlugin(this.createRenderer(), this.getRenderRequests())
      );
    }
  }

  configureServer(app, middlewares, mode) {
    if (mode === 'static' || mode === 'develop') {
      const {
        createWebpackMiddleware,
      } = require('../../lib/middlewares/render');

      middlewares.routes.push(
        createWebpackMiddleware(['node'], mode === 'develop', this)
      );
    }

    if (mode === 'serve') {
      const { serverDir, serverFile } = this.config;
      const serverFilePath = join(serverDir, serverFile);

      if (exists(serverFilePath)) {
        middlewares.routes.push(require(serverFilePath));
      }
    }
  }

  configureCommand({ command, builder }) {
    if (command === 'start' || command === 'build') {
      builder.static = {
        alias: 's',
        default: false,
        describe: 'Statically build locations',
        type: 'boolean',
      };
      if (command === 'start' && process.env.NODE_ENV !== 'production') {
        builder.static.implies = ['static', 'production'];
        builder.static.describe += ' (requires --production, -p)';
      }
    }
  }

  handleArguments(argv) {
    this.options = { ...this.options, ...argv };
  }
}

WebpackRenderMixin.strategies = {
  getRenderRequests: validate(
    override,
    ({ length }) => {
      invariant(
        length === 0,
        'getRenderRequests(): Received unexpected argument(s)'
      );
    },
    (result) => {
      invariant(
        Array.isArray(result),
        'getRenderRequests(): Returned invalid requests array'
      );
    }
  ),
};

module.exports = WebpackRenderMixin;
