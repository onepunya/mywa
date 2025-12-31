## UPDATE INFORMATION – v5.1

In version 5.1, there might still be some bugs after the migration process from CJS to ESM.
If you find an error, please open an issue.

Please note:

- Buttons and Interactive Messages are only supported when using **@neoxr/baileys** or a modified version of Baileys.

- The latest version of Baileys (v7) no longer supports sending Buttons and Interactive Messages.

### BOT SETUP

Before installing modules, etc., make sure the server used meets the following requirements:

- [x] The server supports NodeJS >= 20 installation
- [x] The server supports the installation of FFMPEG, Git, Canvas, Sharp, and SQLite
- [x] The server can send emails (SMTP)
- [x] Server vCPU/RAM 1/1GB (Min)

Next, edit the configuration in the [config.json](https://github.com/neoxr/v5.1-optima/blob/5.1-ESM/config.json) file and the [.env](https://github.com/neoxr/v5.1-optima/blob/5.1-ESM/.env) file.

This script contains 2 automatic configuration files for Apache and Cloudflare Tunneling (choose one):

#### 1. APACHE

```bash
$ bash apache.sh domain port
```

#### 2. CLOUDFLARE TUNNELING

```bash
$ bash tunnel.sh domain port
```

Perform the license verification with the following command until the "Passcode" prompt appears and enter the pin:

```bash
$ node .
```

If all plugins have been loaded successfully, press CTRL+C and run the bot using PM2 to keep it always on:

```bash
$ pm2 start pm2.config.cjs --only bot && pm2 logs bot
```

### BOT + GATEWAY (DASHBOARD) SETUP

The bot setup process is identical to the one described above. This section focuses specifically on the gateway (dashboard) setup.

Before you begin, ensure the following prerequisites are met:
1. The server port you intend to use is not blocked by a firewall.
2. You have a domain name that is already linked to your Cloudflare account.

First, you need to configure your domain in two files:
- [nuxt/nuxt.config.ts](https://github.com/neoxr/v5.1-optima/blob/5.1-ESM/nuxt/nuxt.config.ts)
- [.env](https://github.com/neoxr/v5.1-optima/blob/5.1-ESM/.env)

After setting your domain, run the setup script with your domain and port as arguments:

```bash
$ bash tunnel.sh your_domain your_port
```

For example, if your .env file is configured like this:

```env
DOMAIN = 'https://wapify.neoxr.eu'
PORT = 3001
JWT_SECRET = 'neoxr'
JWT_EXPIRY = '72h'
```

You would execute the setup script as follows:

```bash
$ bash tunnel.sh wapify.neoxr.eu 3001
```

Then generate a build template:

```bash
$ yarn run build
```

Next, go to your Cloudflare dashboard and create a new A record. Point this record to the IPv4 address of your VPS.

```bash
$ pm2 start pm2.config.cjs --only gateway && pm2 logs gateway
```