const React = require('react');
const { existsSync, readFileSync } = require('fs');
const {
  Mixin,
  strategies: {
    sync: { override, callable, sequence },
  },
} = require('hops-mixin');

const { ApolloProvider, getDataFromTree } = require('react-apollo');
const { default: ApolloClient } = require('apollo-client');
const { ApolloLink } = require('apollo-link');
const { HttpLink } = require('apollo-link-http');
const {
  InMemoryCache,
  IntrospectionFragmentMatcher,
  HeuristicFragmentMatcher,
} = require('apollo-cache-inmemory');
const fetch = require('cross-fetch');

const errorLink = new ApolloLink((operation, forward) =>
  forward(operation).map(response => {
    console.log('response', response);
    console.log('context', operation.getContext());

    return response;
  })
);

const customFetch = () => async (uri, options) => {
  const response = await fetch(uri, options);
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.startsWith('application/json')) {
    throw new Error(`

Invalid response from ${uri}.

Make sure to apply a valid GraphQL API endpoint to the
"graphqlUri"-value of your Hops configuration.
`);
  }

  return response;
};

let introspectionResult = undefined;

class GraphQLMixin extends Mixin {
  constructor(config, element, { graphql: options = {} } = {}) {
    super(config, element);

    this.options = options;

    if (introspectionResult === undefined) {
      try {
        if (existsSync(config.fragmentsFile)) {
          const fileContent = readFileSync(config.fragmentsFile, 'utf-8');
          introspectionResult = JSON.parse(fileContent);
        }
      } catch (_) {
        introspectionResult = null;
      }
    }
  }

  getApolloClient() {
    if (this.client) {
      return this.client;
    }
    return (this.client = this.createClient(this.options));
  }

  createClient(options) {
    return new ApolloClient(this.enhanceClientOptions(options));
  }

  enhanceClientOptions(options) {
    return {
      ...options,
      link: this.getApolloLink(),
      cache: this.getApolloCache(),
      ssrMode: true,
    };
  }

  getApolloLink() {
    return (
      this.options.link ||
      errorLink.concat(
        new HttpLink({
          uri: this.config.graphqlUri,
          fetch: customFetch(),
        })
      )
    );
  }

  getApolloCache() {
    return (
      this.options.cache ||
      new InMemoryCache({ fragmentMatcher: this.createFragmentMatcher() })
    );
  }

  createFragmentMatcher() {
    return !introspectionResult
      ? new HeuristicFragmentMatcher()
      : new IntrospectionFragmentMatcher({
          introspectionQueryResultData: introspectionResult,
        });
  }

  fetchData(data = {}, element) {
    return this.prefetchData(element).then(() => data);
  }

  prefetchData(element) {
    const prefetchOnServer = this.canPrefetchOnServer().every(value => value);

    return prefetchOnServer ? getDataFromTree(element) : Promise.resolve();
  }

  canPrefetchOnServer() {
    const { shouldPrefetchOnServer } = this.config;

    return shouldPrefetchOnServer !== false;
  }

  getTemplateData(data) {
    return {
      ...data,
      globals: {
        ...data.globals,
        APOLLO_FRAGMENT_TYPES: introspectionResult,
        APOLLO_STATE: this.getApolloClient().cache.extract(),
      },
    };
  }

  enhanceElement(reactElement) {
    return React.createElement(
      ApolloProvider,
      { client: this.getApolloClient() },
      reactElement
    );
  }
}

GraphQLMixin.strategies = {
  getApolloLink: override,
  getApolloCache: override,
  createFragmentMatcher: callable,
  canPrefetchOnServer: sequence,
};

module.exports = GraphQLMixin;
