const React = require('react');
const {
  Mixin,
  strategies: {
    sync: { override, callable },
  },
} = require('hops-mixin');

const { ApolloProvider } = require('react-apollo');
const { default: ApolloClient } = require('apollo-client');
const { ApolloLink } = require('apollo-link');
const { HttpLink } = require('apollo-link-http');
const {
  InMemoryCache,
  IntrospectionFragmentMatcher,
  HeuristicFragmentMatcher,
} = require('apollo-cache-inmemory');
require('cross-fetch/polyfill');

const errorLink = new ApolloLink((operation, forward) =>
  forward(operation).map(response => {
    console.log('response', response);
    console.log('context', operation.getContext());

    return response;
  })
);

const customFetch = () => async (uri, options) => {
  const response = await global.fetch(uri, options);
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

class GraphQLMixin extends Mixin {
  constructor(config, element, { graphql: options = {} } = {}) {
    super(config, element);

    this.options = options;
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
      new InMemoryCache({
        fragmentMatcher: this.createFragmentMatcher(),
      }).restore(global['APOLLO_STATE'])
    );
  }

  createFragmentMatcher() {
    if (global['APOLLO_FRAGMENT_TYPES']) {
      return new IntrospectionFragmentMatcher({
        introspectionQueryResultData: global['APOLLO_FRAGMENT_TYPES'],
      });
    }
    return new HeuristicFragmentMatcher();
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
};

module.exports = GraphQLMixin;
