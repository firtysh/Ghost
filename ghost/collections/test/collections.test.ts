import assert from 'assert/strict';
import sinon from 'sinon';
import DomainEvents from '@tryghost/domain-events';
import {
    CollectionsService,
    CollectionsRepositoryInMemory,
    CollectionResourceChangeEvent,
    PostDeletedEvent,
    PostAddedEvent,
    PostEditedEvent
} from '../src/index';
import {PostsRepositoryInMemory} from './fixtures/PostsRepositoryInMemory';
import {posts} from './fixtures/posts';

const initPostsRepository = (): PostsRepositoryInMemory => {
    const postsRepository = new PostsRepositoryInMemory();

    for (const post of posts) {
        const collectionPost = {
            id: post.id,
            title: post.title,
            slug: post.slug,
            featured: post.featured,
            published_at: post.published_at,
            deleted: false
        };
        postsRepository.save(collectionPost);
    }

    return postsRepository;
};

describe('CollectionsService', function () {
    let collectionsService: CollectionsService;
    let postsRepository: PostsRepositoryInMemory;

    beforeEach(async function () {
        const collectionsRepository = new CollectionsRepositoryInMemory();
        postsRepository = initPostsRepository();

        collectionsService = new CollectionsService({
            collectionsRepository,
            postsRepository,
            DomainEvents,
            slugService: {
                async generate(input) {
                    return input.replace(/\s+/g, '-').toLowerCase();
                }
            }
        });
    });

    it('Instantiates a CollectionsService', function () {
        assert.ok(collectionsService, 'CollectionsService should initialize');
    });

    it('Can do CRUD operations on a collection', async function () {
        const savedCollection = await collectionsService.createCollection({
            title: 'testing collections',
            description: 'testing collections description',
            type: 'manual',
            filter: null
        });

        const createdCollection = await collectionsService.getById(savedCollection.id);

        assert.ok(createdCollection, 'Collection should be saved');
        assert.ok(createdCollection.id, 'Collection should have an id');
        assert.equal(createdCollection.title, 'testing collections', 'Collection title should match');

        const allCollections = await collectionsService.getAll();
        assert.equal(allCollections.data.length, 1, 'There should be one collection');

        await collectionsService.destroy(createdCollection.id);
        const deletedCollection = await collectionsService.getById(savedCollection.id);

        assert.equal(deletedCollection, null, 'Collection should be deleted');
    });

    it('Can retrieve a collection by slug', async function () {
        const savedCollection = await collectionsService.createCollection({
            title: 'slug test',
            slug: 'get-me-by-slug',
            type: 'manual',
            filter: null
        });

        const retrievedCollection = await collectionsService.getBySlug('get-me-by-slug');
        assert.ok(retrievedCollection, 'Collection should be saved');
        assert.ok(retrievedCollection.slug, 'Collection should have a slug');
        assert.equal(savedCollection.title, 'slug test', 'Collection title should match');

        const nonExistingCollection = await collectionsService.getBySlug('i-do-not-exist');
        assert.equal(nonExistingCollection, null, 'Collection should not exist');
    });

    it('Throws when built in collection is attempted to be deleted', async function () {
        const collection = await collectionsService.createCollection({
            title: 'Featured Posts',
            slug: 'featured',
            description: 'Collection of featured posts',
            type: 'automatic',
            deletable: false,
            filter: 'featured:true'
        });

        await assert.rejects(async () => {
            await collectionsService.destroy(collection.id);
        }, (err: any) => {
            assert.equal(err.message, 'Cannot delete builtin collection', 'Error message should match');
            assert.equal(err.context, `The collection ${collection.id} is a builtin collection and cannot be deleted`, 'Error context should match');
            return true;
        });
    });

    describe('getCollectionsForPost', function () {
        it('Can get collections for a post', async function () {
            const collection = await collectionsService.createCollection({
                title: 'testing collections',
                slug: 'testing-collections',
                type: 'manual'
            });

            const collection2 = await collectionsService.createCollection({
                title: 'testing collections 1',
                slug: '1-testing-collections',
                type: 'manual'
            });

            await collectionsService.addPostToCollection(collection.id, posts[0]);
            await collectionsService.addPostToCollection(collection2.id, posts[0]);

            const collections = await collectionsService.getCollectionsForPost(posts[0].id);

            assert.equal(collections.length, 2, 'There should be one collection');
            assert.equal(collections[0].id, collection2.id, 'Collections should be sorted by slug');
            assert.equal(collections[1].id, collection.id, 'Collections should be sorted by slug');
        });
    });

    describe('getAllPosts', function () {
        it('Can get paged posts of a collection by collection id', async function () {
            const collection = await collectionsService.createCollection({
                title: 'testing paging',
                type: 'manual'
            });

            for (const post of posts) {
                await collectionsService.addPostToCollection(collection.id, post);
            }

            const postsPage1 = await collectionsService.getAllPosts(collection.id, {page: 1, limit: 2});

            assert.ok(postsPage1, 'Posts should be returned');
            assert.equal(postsPage1.meta.pagination.page, 1, 'Page should be 1');
            assert.equal(postsPage1.meta.pagination.limit, 2, 'Limit should be 2');
            assert.equal(postsPage1.meta.pagination.pages, 2, 'Pages should be 2');
            assert.equal(postsPage1.data.length, 2, 'There should be 2 posts');
            assert.equal(postsPage1.data[0].id, posts[0].id, 'First post should be the correct one');
            assert.equal(postsPage1.data[1].id, posts[1].id, 'Second post should be the correct one');

            const postsPage2 = await collectionsService.getAllPosts(collection.id, {page: 2, limit: 2});

            assert.ok(postsPage2, 'Posts should be returned');
            assert.equal(postsPage2.meta.pagination.page, 2, 'Page should be 2');
            assert.equal(postsPage2.meta.pagination.limit, 2, 'Limit should be 2');
            assert.equal(postsPage2.meta.pagination.pages, 2, 'Pages should be 2');
            assert.equal(postsPage2.data.length, 2, 'There should be 2 posts');
            assert.equal(postsPage2.data[0].id, posts[2].id, 'First post should be the correct one');
            assert.equal(postsPage2.data[1].id, posts[3].id, 'Second post should be the correct one');
        });

        it('Can get paged posts of a collection by collection slug', async function () {
            const collection = await collectionsService.createCollection({
                title: 'testing fetch by slug',
                slug: 'testing-fetch-by-slug',
                type: 'manual'
            });

            for (const post of posts) {
                await collectionsService.addPostToCollection(collection.id, post);
            }

            const postsPage1 = await collectionsService.getAllPosts(collection.slug, {page: 1, limit: 2});

            assert.ok(postsPage1, 'Posts should be returned');
            assert.equal(postsPage1.meta.pagination.page, 1, 'Page should be 1');
            assert.equal(postsPage1.meta.pagination.limit, 2, 'Limit should be 2');
            assert.equal(postsPage1.meta.pagination.pages, 2, 'Pages should be 2');
            assert.equal(postsPage1.data.length, 2, 'There should be 2 posts');
            assert.equal(postsPage1.data[0].id, posts[0].id, 'First post should be the correct one');
            assert.equal(postsPage1.data[1].id, posts[1].id, 'Second post should be the correct one');

            const postsPage2 = await collectionsService.getAllPosts(collection.slug, {page: 2, limit: 2});

            assert.ok(postsPage2, 'Posts should be returned');
            assert.equal(postsPage2.meta.pagination.page, 2, 'Page should be 2');
            assert.equal(postsPage2.meta.pagination.limit, 2, 'Limit should be 2');
            assert.equal(postsPage2.meta.pagination.pages, 2, 'Pages should be 2');
            assert.equal(postsPage2.data.length, 2, 'There should be 2 posts');
            assert.equal(postsPage2.data[0].id, posts[2].id, 'First post should be the correct one');
            assert.equal(postsPage2.data[1].id, posts[3].id, 'Second post should be the correct one');
        });

        it('Throws when trying to get posts of a collection that does not exist', async function () {
            await assert.rejects(async () => {
                await collectionsService.getAllPosts('fake id', {});
            }, (err: any) => {
                assert.equal(err.message, 'Collection not found', 'Error message should match');
                assert.equal(err.context, 'Collection with id: fake id does not exist', 'Error context should match');
                return true;
            });
        });
    });

    describe('addPostToCollection', function () {
        it('Can add a Post to a Collection', async function () {
            const collection = await collectionsService.createCollection({
                title: 'testing collections',
                description: 'testing collections description',
                type: 'manual'
            });

            const editedCollection = await collectionsService.addPostToCollection(collection.id, posts[0]);

            assert.equal(editedCollection?.posts.length, 1, 'Collection should have one post');
            assert.equal(editedCollection?.posts[0].id, posts[0].id, 'Collection should have the correct post');
        });

        it('Does not error when trying to add a post to a collection that does not exist', async function () {
            const editedCollection = await collectionsService.addPostToCollection('fake id', posts[0]);
            assert(editedCollection === null);
        });
    });

    describe('edit', function () {
        it('Can edit existing collection', async function () {
            const savedCollection = await collectionsService.createCollection({
                title: 'testing collections',
                description: 'testing collections description',
                type: 'manual'
            });

            const editedCollection = await collectionsService.edit({
                id: savedCollection.id,
                title: 'Edited title',
                description: 'Edited description',
                feature_image: '/assets/images/edited.jpg',
                slug: 'changed'
            });

            assert.equal(editedCollection?.title, 'Edited title', 'Collection title should be edited');
            assert.equal(editedCollection?.slug, 'changed', 'Collection slug should be edited');
            assert.equal(editedCollection?.description, 'Edited description', 'Collection description should be edited');
            assert.equal(editedCollection?.feature_image, '/assets/images/edited.jpg', 'Collection feature_image should be edited');
            assert.equal(editedCollection?.type, 'manual', 'Collection type should not be edited');
        });

        it('Resolves to null when editing unexistend collection', async function () {
            const editedCollection = await collectionsService.edit({
                id: '12345'
            });

            assert.equal(editedCollection, null, 'Collection should be null');
        });

        it('Adds a Post to a Collection', async function () {
            const collection = await collectionsService.createCollection({
                title: 'testing collections',
                description: 'testing collections description',
                type: 'manual'
            });

            const editedCollection = await collectionsService.edit({
                id: collection.id,
                posts: [{
                    id: posts[0].id
                }]
            });

            assert.equal(editedCollection?.posts.length, 1, 'Collection should have one post');
            assert.equal(editedCollection?.posts[0].id, posts[0].id, 'Collection should have the correct post');
            assert.equal(editedCollection?.posts[0].sort_order, 0, 'Collection should have the correct post sort order');
        });

        it('Removes a Post from a Collection', async function () {
            const collection = await collectionsService.createCollection({
                title: 'testing collections',
                description: 'testing collections description',
                type: 'manual'
            });

            let editedCollection = await collectionsService.edit({
                id: collection.id,
                posts: [{
                    id: posts[0].id
                }, {
                    id: posts[1].id
                }]
            });

            assert.equal(editedCollection?.posts.length, 2, 'Collection should have two posts');

            editedCollection = await collectionsService.removePostFromCollection(collection.id, posts[0].id);

            assert.equal(editedCollection?.posts.length, 1, 'Collection should have one posts');
        });

        it('Returns null when removing post from non existing collection', async function () {
            const collection = await collectionsService.removePostFromCollection('i-do-not-exist', posts[0].id);

            assert.equal(collection, null, 'Collection should be null');
        });
    });

    describe('subscribeToEvents', function () {
        it('Subscribes to Domain Events', async function () {
            const updateCollectionsSpy = sinon.spy(collectionsService, 'updateCollections');
            const collectionChangeEvent = CollectionResourceChangeEvent.create('tag.added', {
                id: 'test-id'
            });

            DomainEvents.dispatch(collectionChangeEvent);
            await DomainEvents.allSettled();
            assert.equal(updateCollectionsSpy.calledOnce, false, 'updateCollections should not be called yet');

            collectionsService.subscribeToEvents();

            DomainEvents.dispatch(collectionChangeEvent);
            await DomainEvents.allSettled();

            assert.equal(updateCollectionsSpy.calledOnce, true, 'updateCollections should be called');
        });
    });

    describe('Automatic Collections', function () {
        it('Can create an automatic collection', async function () {
            const collection = await collectionsService.createCollection({
                title: 'I am automatic',
                description: 'testing automatic collection',
                type: 'automatic',
                filter: 'featured:true'
            });

            assert.equal(collection.type, 'automatic', 'Collection should be automatic');
            assert.equal(collection.filter, 'featured:true', 'Collection should have the correct filter');

            assert.equal(collection.posts.length, 2, 'Collection should have two posts');
        });

        it('Updates the automatic collection posts when the filter is changed', async function () {
            let collection = await collectionsService.createCollection({
                title: 'I am automatic',
                description: 'testing automatic collection',
                type: 'automatic',
                filter: 'featured:true'
            });

            assert.equal(collection?.type, 'automatic', 'Collection should be automatic');
            assert.equal(collection?.posts.length, 2, 'Collection should have two featured post');
            assert.equal(collection?.posts[0].id, 'post-3-featured', 'Collection should have the correct post');
            assert.equal(collection?.posts[1].id, 'post-4-featured', 'Collection should have the correct post');

            let updatedCollection = await collectionsService.edit({
                id: collection.id,
                filter: 'slug:post-2'
            });

            assert.equal(updatedCollection?.posts.length, 1, 'Collection should have one post');
            assert.equal(updatedCollection?.posts[0].id, 'post-2', 'Collection should have the correct post');
        });

        describe('updateCollections', function () {
            let automaticFeaturedCollection: any;
            let automaticNonFeaturedCollection: any;
            let manualCollection: any;

            beforeEach(async function () {
                automaticFeaturedCollection = await collectionsService.createCollection({
                    title: 'Featured Collection',
                    description: 'testing automatic collection',
                    type: 'automatic',
                    filter: 'featured:true'
                });

                automaticNonFeaturedCollection = await collectionsService.createCollection({
                    title: 'Non-Featured Collection',
                    description: 'testing automatic collection',
                    type: 'automatic',
                    filter: 'featured:false'
                });

                manualCollection = await collectionsService.createCollection({
                    title: 'Manual Collection',
                    description: 'testing manual collection',
                    type: 'manual'
                });

                await collectionsService.addPostToCollection(manualCollection.id, posts[0]);
                await collectionsService.addPostToCollection(manualCollection.id, posts[1]);
            });

            afterEach(async function () {
                await collectionsService.destroy(automaticFeaturedCollection.id);
                await collectionsService.destroy(automaticNonFeaturedCollection.id);
                await collectionsService.destroy(manualCollection.id);
            });

            it('Updates all collections when post is deleted', async function () {
                assert.equal((await collectionsService.getById(automaticFeaturedCollection.id))?.posts?.length, 2);
                assert.equal((await collectionsService.getById(automaticNonFeaturedCollection.id))?.posts.length, 2);
                assert.equal((await collectionsService.getById(manualCollection.id))?.posts.length, 2);

                collectionsService.subscribeToEvents();
                const postDeletedEvent = PostDeletedEvent.create({
                    id: posts[0].id
                });

                DomainEvents.dispatch(postDeletedEvent);
                await DomainEvents.allSettled();

                assert.equal((await collectionsService.getById(automaticFeaturedCollection.id))?.posts?.length, 2);
                assert.equal((await collectionsService.getById(automaticNonFeaturedCollection.id))?.posts.length, 1);
                assert.equal((await collectionsService.getById(manualCollection.id))?.posts.length, 1);
            });

            it('Updates only index collection when a non-featured post is added', async function () {
                assert.equal((await collectionsService.getById(automaticFeaturedCollection.id))?.posts?.length, 2);
                assert.equal((await collectionsService.getById(automaticNonFeaturedCollection.id))?.posts.length, 2);
                assert.equal((await collectionsService.getById(manualCollection.id))?.posts.length, 2);

                collectionsService.subscribeToEvents();
                const postAddedEvent = PostAddedEvent.create({
                    id: 'non-featured-post',
                    featured: false
                });

                DomainEvents.dispatch(postAddedEvent);
                await DomainEvents.allSettled();

                assert.equal((await collectionsService.getById(automaticFeaturedCollection.id))?.posts?.length, 2);
                assert.equal((await collectionsService.getById(automaticNonFeaturedCollection.id))?.posts.length, 3);
                assert.equal((await collectionsService.getById(manualCollection.id))?.posts.length, 2);
            });

            it('Updates automatic collections only when post is published', async function () {
                const newPost = {
                    id: 'post-published',
                    title: 'Post Published',
                    slug: 'post-published',
                    featured: true,
                    published_at: new Date('2023-03-16T07:19:07.447Z'),
                    deleted: false
                };
                await postsRepository.save(newPost);

                collectionsService.subscribeToEvents();
                const updateCollectionEvent = CollectionResourceChangeEvent.create('post.published', {
                    id: newPost.id
                });

                DomainEvents.dispatch(updateCollectionEvent);
                await DomainEvents.allSettled();

                assert.equal((await collectionsService.getById(automaticFeaturedCollection.id))?.posts?.length, 3);
                assert.equal((await collectionsService.getById(automaticNonFeaturedCollection.id))?.posts.length, 2);
                assert.equal((await collectionsService.getById(manualCollection.id))?.posts.length, 2);
            });

            it('Moves post form featured to non featured collection when the featured attribute is changed', async function () {
                collectionsService.subscribeToEvents();
                const newFeaturedPost = {
                    id: 'post-featured',
                    title: 'Post Featured',
                    slug: 'post-featured',
                    featured: false,
                    published_at: new Date('2023-03-16T07:19:07.447Z'),
                    deleted: false
                };
                await postsRepository.save(newFeaturedPost);
                const updateCollectionEvent = PostEditedEvent.create({
                    id: newFeaturedPost.id,
                    current: {
                        id: newFeaturedPost.id,
                        featured: false
                    },
                    previous: {
                        id: newFeaturedPost.id,
                        featured: true
                    }
                });

                DomainEvents.dispatch(updateCollectionEvent);
                await DomainEvents.allSettled();

                assert.equal((await collectionsService.getById(automaticFeaturedCollection.id))?.posts?.length, 2);
                assert.equal((await collectionsService.getById(automaticNonFeaturedCollection.id))?.posts.length, 3);
                assert.equal((await collectionsService.getById(manualCollection.id))?.posts.length, 2);

                // change featured back to true
                const updateCollectionEventBackToFeatured = PostEditedEvent.create({
                    id: newFeaturedPost.id,
                    current: {
                        id: newFeaturedPost.id,
                        featured: true
                    },
                    previous: {
                        id: newFeaturedPost.id,
                        featured: false
                    }
                });

                DomainEvents.dispatch(updateCollectionEventBackToFeatured);
                await DomainEvents.allSettled();

                assert.equal((await collectionsService.getById(automaticFeaturedCollection.id))?.posts?.length, 3);
                assert.equal((await collectionsService.getById(automaticNonFeaturedCollection.id))?.posts.length, 2);
                assert.equal((await collectionsService.getById(manualCollection.id))?.posts.length, 2);
            });
        });
    });
});
