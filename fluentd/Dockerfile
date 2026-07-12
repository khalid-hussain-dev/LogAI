FROM fluent/fluentd:v1.16-1

USER root

# Install Redis and Elasticsearch plugins
# Pin redis gem to 4.x (fluent-plugin-redis-store 0.2.0 uses :thread_safe removed in 5.x)
RUN gem install redis -v '~> 4.8' \
    && gem install fluent-plugin-redis-store \
    && gem install fluent-plugin-elasticsearch

# Create buffer directory with correct permissions BEFORE switching user
RUN mkdir -p /fluentd/buffer/redis && chown -R fluent:fluent /fluentd/buffer

USER fluent

COPY conf/fluent.conf /fluentd/etc/fluent.conf

EXPOSE 24224 9880 5140

