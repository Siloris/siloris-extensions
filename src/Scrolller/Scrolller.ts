import {
    BadgeColor,
    Chapter,
    ChapterDetails,
    ChapterProviding,
    ContentRating,
    HomePageSectionsProviding,
    HomeSection,
    MangaProviding,
    PagedResults,
    PartialSourceManga,
    RequestManagerProviding,
    SearchRequest,
    SearchResultsProviding,
    SourceInfo,
    SourceIntents,
    SourceManga,
    TagSection
} from '@paperback/types';

import { ScrolllerClient } from './ScrolllerClient';

export const ScrolllerInfo: SourceInfo = {
    version: '2.0.0',
    name: 'Scrolller',
    icon: 'icon.png',
    author: 'Siloris',
    authorWebsite: 'https://siloris.github.io/siloris-extensions',
    description: 'Scrolller Reddit Images',
    contentRating: ContentRating.ADULT,
    websiteBaseURL: 'https://scrolller.com/',
    sourceTags: [
        {
            text: '18+',
            type: BadgeColor.RED,
        },
    ],
    intents: SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.MANGA_CHAPTERS
};

export class Scrolller implements ChapterProviding, HomePageSectionsProviding, MangaProviding, RequestManagerProviding, SearchResultsProviding {

    client = new ScrolllerClient();

    requestManager = App.createRequestManager({
        requestsPerSecond: 2,
        requestTimeout: 20000,
        interceptor: this.client
    });

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({image: "https://cdn2.steamgriddb.com/thumb/f35e822e381c6f3027d54281f5054dc2.jpg", desc: "Reddit Image Source", status: "OnGoing", titles: [mangaId.split("!+!")[0] ?? "SubReddit"]})
        });
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {

        let nsfw = false
        if (mangaId.endsWith('nsfw')){
            nsfw = true
            mangaId = mangaId.replace('nsfw', '')
        } else {
            mangaId = mangaId.replace('sfw', '')
        }

        mangaId = mangaId.split("!+!")[1] ?? "0"

        let variables: ScrolllerClient.VariablesObject = {
            subredditId: Number.parseInt(mangaId),
            filter: "PICTURE",
            sortBy: "TOP",
            limit: 30,
            isNsfw: nsfw
        }

        let result: ScrolllerClient.ImagesResult = await this.client.getImagesFor(variables, this.requestManager, true)

        let chapters: Chapter[] = []

        chapters.push(App.createChapter({
            id: "firstof" + mangaId,
            chapNum: 1,
        }))

        let i = 1
        let seenIterators: string[] = []

        while (result?.iterator !== null && result?.iterator !== undefined && !seenIterators.includes(result.iterator) && i < 101) {
            i++
            seenIterators.push(result.iterator)
            
            variables.iterator = result.iterator
            result = await this.client.getImagesFor(variables, this.requestManager, true)

            chapters.push(App.createChapter({
                id: variables.iterator ?? "error",
                chapNum: i,
            }))
        }

        return chapters.slice(0, -1)
    }

    async getChapterDetails(
        mangaId: string,
        chapterId: string
    ): Promise<ChapterDetails> {

        let nsfw = false
        if (mangaId.endsWith('nsfw')){
            nsfw = true
            mangaId = mangaId.replace('nsfw', '')
        } else {
            mangaId = mangaId.replace('sfw', '')
        }

        mangaId = mangaId.split("!+!")[1] ?? "0"

        let variables: ScrolllerClient.VariablesObject = {
            subredditId: Number.parseInt(mangaId),
            filter: "PICTURE",
            sortBy: "TOP",
            limit: 30,
            isNsfw: nsfw
        }

        if (!chapterId.startsWith("firstof")){ variables.iterator = chapterId }

        let result: ScrolllerClient.ImagesResult = await this.client.getImagesFor(variables, this.requestManager, false)

        return App.createChapterDetails({
            id: chapterId + "DETAIL",
            mangaId: mangaId,
            pages: result.pages
        });
    }

    async getSearchResults(
        searchQuery: SearchRequest,
        metadata: any
    ): Promise<PagedResults> {

        if ((searchQuery.title?.length ?? 0) < 3){
            return App.createPagedResults({results: []})
        }

        let variables: ScrolllerClient.VariablesObject = {
            query: searchQuery.title,
            limit: 3,
            pageIndex: 0
        }

        let results = await this.client.getSearchResultsFor(variables, this.requestManager)

        return App.createPagedResults({
            results: results.map(sub => {
                return App.createPartialSourceManga({
                    mangaId: (sub.title ?? "SubReddit") + "!+!" + sub.id.toString() + (sub.isNsfw ? "nsfw" : "sfw"), 
                    image: "https://cdn2.steamgriddb.com/thumb/f35e822e381c6f3027d54281f5054dc2.jpg", 
                    title: sub.title ?? sub.id.toString()
                })
            }),
            metadata: undefined
        })
    }

    async getSearchTags(): Promise<TagSection[]> {
        return [];
    }

    async getHomePageSections(
        sectionCallback: (section: HomeSection) => void
    ): Promise<void> {

        let variablesSfw: ScrolllerClient.VariablesObject = {
            childLimit: 1,
            excludeFilters: [],
            filter: "PICTURE",
            includeFilters: [],
            isNsfw: false,
            sortBy: "RANDOM",
            limit: 3
        }

        let resultsSfw: ScrolllerClient.SubReddit[] = await this.client.getDiscoverResultsFor(variablesSfw, this.requestManager)

        let variablesNsfw: ScrolllerClient.VariablesObject = {
            childLimit: 1,
            excludeFilters: [],
            filter: "PICTURE",
            includeFilters: [],
            isNsfw: true,
            sortBy: "RANDOM",
            limit: 3
        }

        let resultsNsfw: ScrolllerClient.SubReddit[] = await this.client.getDiscoverResultsFor(variablesNsfw, this.requestManager)

        let sourcesSfw: PartialSourceManga[] = []
        let sourcesNsfw: PartialSourceManga[] = []

        resultsSfw.forEach(result => {
            sourcesSfw.push(App.createPartialSourceManga({
                mangaId: (result.title ?? "SubReddit") + "!+!" + result.id.toString() + (result.isNsfw ? 'nsfw' : 'sfw'), 
                image: "https://cdn2.steamgriddb.com/thumb/f35e822e381c6f3027d54281f5054dc2.jpg", 
                title: result.title ?? "SubReddit",
                subtitle: result.description ?? ""
            }))
        })

        resultsNsfw.forEach(result => {
            sourcesNsfw.push(App.createPartialSourceManga({
                mangaId: (result.title ?? "SubReddit") + "!+!" + result.id.toString() + (result.isNsfw ? 'nsfw' : 'sfw'), 
                image: "https://cdn2.steamgriddb.com/thumb/f35e822e381c6f3027d54281f5054dc2.jpg", 
                title: result.title ?? "SubReddit",
                subtitle: result.description ?? ""
            }))
        })
        
        sectionCallback(
            App.createHomeSection({ 
                id: 'rd-discover-1',
                title: 'Discover',
                items: [],
                containsMoreItems: false,
                type: 'singleRowNormal'
            })
        );
        sectionCallback(
            App.createHomeSection({ 
                id: 'rd-discover-2',
                title: 'SFW',
                items: sourcesSfw,
                containsMoreItems: false,
                type: 'singleRowNormal'
            })
        );
        sectionCallback(
            App.createHomeSection({ 
                id: 'rd-discover-3',
                title: 'NSFW',
                items: sourcesNsfw,
                containsMoreItems: false,
                type: 'singleRowNormal'
            })
        );
        return;
    }

    async getViewMoreItems(
        homepageSectionId: string,
        metadata: any
    ): Promise<PagedResults> {
        return App.createPagedResults({
            results: [],
            metadata: metadata
        });
    }
}