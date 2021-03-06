const { EOL } = require('os');
const stripAnsi = require('strip-ansi');
const { serializeError } = require('serialize-error');

class BuildError extends Error {
  constructor(stack) {
    super();
    this.name = this.constructor.name;
    this.stack = `${this.name}: ${stripAnsi(stack)}`;
    this.message = this.stack.slice(0, this.stack.indexOf(EOL));
  }

  toJSON() {
    return this.stack;
  }
}

exports.BuildError = BuildError;

class CompilerError extends Error {
  constructor(error) {
    super();

    if (error && typeof error === 'object' && error.name && error.message) {
      Object.assign(this, error);
    } else {
      this.message = error;
    }
  }

  toJSON() {
    return serializeError(this);
  }
}

exports.CompilerError = CompilerError;

class CoreJsResolutionError extends Error {
  constructor(pkg) {
    super();
    this.name = this.constructor.name;
    this.pkg = pkg;
    this.stack = '';
    this.message = `There is an incompatible version of core-js

The dependency "${this.pkg}" relies on an (outdated) version of core-js,
which breaks the build of Hops. There are four ways to fix this situation:

1.) Tell the author of the package to not consume core-js in their package,
    but leave the act of polyfilling to the application, that consumes their
    package. In this case Hops.

2.) If possible, open a PR at the package's repository and remove the
    problematic usages of core-js yourself. Beware though, that not every
    open-source project is well maintained & sometimes PRs never get merged.

3.) If it's not possible — for whatever reason — to contribute back to the
    package's project, use patch-package (https://npm.im/patch-package) to
    apply your fix to this package locally via a "postinstall"-hook.

4.) If the author of the package won't remove the usages of core-js and
    removing them yourself is not an option for you, you'll have to find
    an alternative package, that provides a similar functionality, while
    playing by the rules of polyfilling.
`;
  }
}

exports.CoreJsResolutionError = CoreJsResolutionError;
