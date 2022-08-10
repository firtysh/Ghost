// Switch these lines once there are useful utils
// const testUtils = require('./utils');
require('./utils');

const nock = require('nock');
const sinon = require('sinon');

// module under test
const EmailAnalyticsProviderMailgun = require('../');

describe('EmailAnalyticsProviderMailgun', function () {
    let config, settings;

    beforeEach(function () {
        // options objects that can be stubbed or spied
        config = {get() {}};
        settings = {get() {}};
    });

    afterEach(function () {
        sinon.restore();
    });

    describe('fetchAll()', function () {
        it('fetches from now and works backwards', async function () {
            const configStub = sinon.stub(config, 'get');
            configStub.withArgs('bulkEmail').returns({
                mailgun: {
                    apiKey: 'apiKey',
                    domain: 'domain.com',
                    baseUrl: 'https://api.mailgun.net/v3'
                }
            });

            const firstPageMock = nock('https://api.mailgun.net')
                .get('/v3/domain.com/events')
                .query({
                    event: 'delivered OR opened OR failed OR unsubscribed OR complained',
                    limit: 300,
                    tags: 'bulk-email'
                })
                .replyWithFile(200, `${__dirname}/fixtures/all-1.json`, {
                    'Content-Type': 'application/json'
                });

            const secondPageMock = nock('https://api.mailgun.net')
                .get('/v3/domain.com/events/all-1-next')
                .replyWithFile(200, `${__dirname}/fixtures/all-2.json`, {
                    'Content-Type': 'application/json'
                });

            // requests continue until an empty items set is returned
            nock('https://api.mailgun.net')
                .get('/v3/domain.com/events/all-2-next')
                .reply(200, {'Content-Type': 'application/json'}, {
                    items: []
                });

            const mailgunProvider = new EmailAnalyticsProviderMailgun({config, settings});

            const batchHandler = sinon.spy();

            await mailgunProvider.fetchAll(batchHandler);

            firstPageMock.isDone().should.be.true();
            secondPageMock.isDone().should.be.true();
            batchHandler.callCount.should.eql(2); // one per page
        });

        it('supports EU Mailgun domain', async function () {
            const configStub = sinon.stub(config, 'get');
            configStub.withArgs('bulkEmail').returns({
                mailgun: {
                    apiKey: 'apiKey',
                    domain: 'domain.com',
                    baseUrl: 'https://api.eu.mailgun.net/v3'
                }
            });

            const firstPageMock = nock('https://api.eu.mailgun.net')
                .get('/v3/domain.com/events')
                .query({
                    event: 'delivered OR opened OR failed OR unsubscribed OR complained',
                    limit: 300,
                    tags: 'bulk-email'
                })
                .replyWithFile(200, `${__dirname}/fixtures/all-1-eu.json`, {
                    'Content-Type': 'application/json'
                });

            const secondPageMock = nock('https://api.eu.mailgun.net')
                .get('/v3/domain.com/events/all-1-next')
                .replyWithFile(200, `${__dirname}/fixtures/all-2-eu.json`, {
                    'Content-Type': 'application/json'
                });

            // requests continue until an empty items set is returned
            nock('https://api.eu.mailgun.net')
                .get('/v3/domain.com/events/all-2-next')
                .reply(200, {'Content-Type': 'application/json'}, {
                    items: []
                });

            const mailgunProvider = new EmailAnalyticsProviderMailgun({config, settings});

            const batchHandler = sinon.spy();

            await mailgunProvider.fetchAll(batchHandler);

            firstPageMock.isDone().should.be.true();
            secondPageMock.isDone().should.be.true();
            batchHandler.callCount.should.eql(2); // one per page
        });

        it('uses custom tags when supplied', async function () {
            const configStub = sinon.stub(config, 'get');
            configStub.withArgs('bulkEmail').returns({
                mailgun: {
                    apiKey: 'apiKey',
                    domain: 'domain.com',
                    baseUrl: 'https://api.mailgun.net/v3'
                }
            });
            configStub.withArgs('bulkEmail:mailgun:tag').returns('custom-tag');

            const firstPageMock = nock('https://api.mailgun.net')
                .get('/v3/domain.com/events')
                .query({
                    event: 'delivered OR opened OR failed OR unsubscribed OR complained',
                    limit: 300,
                    tags: 'bulk-email AND custom-tag'
                })
                .replyWithFile(200, `${__dirname}/fixtures/all-1.json`, {
                    'Content-Type': 'application/json'
                });

            nock('https://api.mailgun.net')
                .get('/v3/domain.com/events/all-1-next')
                .replyWithFile(200, `${__dirname}/fixtures/all-2.json`, {
                    'Content-Type': 'application/json'
                });

            // requests continue until an empty items set is returned
            nock('https://api.mailgun.net')
                .get('/v3/domain.com/events/all-2-next')
                .reply(200, {'Content-Type': 'application/json'}, {
                    items: []
                });

            const mailgunProvider = new EmailAnalyticsProviderMailgun({config, settings});

            const batchHandler = sinon.spy();

            await mailgunProvider.fetchAll(batchHandler);

            firstPageMock.isDone().should.be.true();
            batchHandler.callCount.should.eql(2); // one per page
        });
    });

    describe('fetchLatest()', function () {
        it('fetches from now and works backwards', async function () {
            const configStub = sinon.stub(config, 'get');
            configStub.withArgs('bulkEmail').returns({
                mailgun: {
                    apiKey: 'apiKey',
                    domain: 'domain.com',
                    baseUrl: 'https://api.mailgun.net/v3'
                }
            });

            const firstPageMock = nock('https://api.mailgun.net')
                .get('/v3/domain.com/events')
                .query({
                    event: 'delivered OR opened OR failed OR unsubscribed OR complained',
                    limit: 300,
                    tags: 'bulk-email',
                    begin: 'Thu, 25 Feb 2021 11:30:00 GMT', // latest minus threshold
                    ascending: 'yes'
                })
                .replyWithFile(200, `${__dirname}/fixtures/all-1.json`, {
                    'Content-Type': 'application/json'
                });

            const secondPageMock = nock('https://api.mailgun.net')
                .get('/v3/domain.com/events/all-1-next')
                .replyWithFile(200, `${__dirname}/fixtures/all-2.json`, {
                    'Content-Type': 'application/json'
                });

            // requests continue until an empty items set is returned
            nock('https://api.mailgun.net')
                .get('/v3/domain.com/events/all-2-next')
                .reply(200, {'Content-Type': 'application/json'}, {
                    items: []
                });

            const mailgunProvider = new EmailAnalyticsProviderMailgun({config, settings});

            const batchHandler = sinon.spy();

            const latestTimestamp = new Date('Thu Feb 25 2021 12:00:00 GMT+0000');
            await mailgunProvider.fetchLatest(latestTimestamp, batchHandler);

            firstPageMock.isDone().should.be.true();
            secondPageMock.isDone().should.be.true();
            batchHandler.callCount.should.eql(2); // one per page
        });

        it('supports EU Mailgun domain', async function () {
            const configStub = sinon.stub(config, 'get');
            configStub.withArgs('bulkEmail').returns({
                mailgun: {
                    apiKey: 'apiKey',
                    domain: 'domain.com',
                    baseUrl: 'https://api.eu.mailgun.net/v3'
                }
            });

            const firstPageMock = nock('https://api.eu.mailgun.net')
                .get('/v3/domain.com/events')
                .query({
                    event: 'delivered OR opened OR failed OR unsubscribed OR complained',
                    limit: 300,
                    tags: 'bulk-email',
                    begin: 'Thu, 25 Feb 2021 11:30:00 GMT', // latest minus threshold
                    ascending: 'yes'
                })
                .replyWithFile(200, `${__dirname}/fixtures/all-1-eu.json`, {
                    'Content-Type': 'application/json'
                });

            const secondPageMock = nock('https://api.eu.mailgun.net')
                .get('/v3/domain.com/events/all-1-next')
                .replyWithFile(200, `${__dirname}/fixtures/all-2-eu.json`, {
                    'Content-Type': 'application/json'
                });

            // requests continue until an empty items set is returned
            nock('https://api.eu.mailgun.net')
                .get('/v3/domain.com/events/all-2-next')
                .reply(200, {'Content-Type': 'application/json'}, {
                    items: []
                });

            const mailgunProvider = new EmailAnalyticsProviderMailgun({config, settings});

            const batchHandler = sinon.spy();

            const latestTimestamp = new Date('Thu Feb 25 2021 12:00:00 GMT+0000');
            await mailgunProvider.fetchLatest(latestTimestamp, batchHandler);

            firstPageMock.isDone().should.be.true();
            secondPageMock.isDone().should.be.true();
            batchHandler.callCount.should.eql(2); // one per page
        });

        it('uses custom tags when supplied', async function () {
            const configStub = sinon.stub(config, 'get');
            configStub.withArgs('bulkEmail').returns({
                mailgun: {
                    apiKey: 'apiKey',
                    domain: 'domain.com',
                    baseUrl: 'https://api.mailgun.net/v3'
                }
            });
            configStub.withArgs('bulkEmail:mailgun:tag').returns('custom-tag');

            const firstPageMock = nock('https://api.mailgun.net')
                .get('/v3/domain.com/events')
                .query({
                    event: 'delivered OR opened OR failed OR unsubscribed OR complained',
                    limit: 300,
                    tags: 'bulk-email AND custom-tag',
                    begin: 'Thu, 25 Feb 2021 11:30:00 GMT', // latest minus threshold
                    ascending: 'yes'
                })
                .replyWithFile(200, `${__dirname}/fixtures/all-1.json`, {
                    'Content-Type': 'application/json'
                });

            nock('https://api.mailgun.net')
                .get('/v3/domain.com/events/all-1-next')
                .replyWithFile(200, `${__dirname}/fixtures/all-2.json`, {
                    'Content-Type': 'application/json'
                });

            // requests continue until an empty items set is returned
            nock('https://api.mailgun.net')
                .get('/v3/domain.com/events/all-2-next')
                .reply(200, {'Content-Type': 'application/json'}, {
                    items: []
                });

            const mailgunProvider = new EmailAnalyticsProviderMailgun({config, settings});

            const batchHandler = sinon.spy();

            const latestTimestamp = new Date('Thu Feb 25 2021 12:00:00 GMT+0000');
            await mailgunProvider.fetchLatest(latestTimestamp, batchHandler);

            firstPageMock.isDone().should.be.true();
            batchHandler.callCount.should.eql(2); // one per page
        });
    });
});
