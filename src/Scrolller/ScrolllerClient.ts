import {
	Request,
	SourceInterceptor,
	Response,
  RequestManager
} from '@paperback/types';
export class ScrolllerClient implements SourceInterceptor {
	private static readonly API_URL = "https://api.scrolller.com/admin";

	async interceptResponse(response: Response): Promise<Response> {
		return response;
	}

	async interceptRequest(request: Request): Promise<Request> {
		return request;
	}

	public async getImagesFor(
		variables: ScrolllerClient.VariablesObject,
    	requestManager: RequestManager,
		onlyChapters: boolean
	): Promise<ScrolllerClient.ImagesResult> {
		
		let imageQuery = `
			query SubredditChildrenQuery(
				$subredditId: Int!, 
				$iterator: String, 
				$filter: GalleryFilter, 
				$sortBy: GallerySortBy, 
				$limit: Int!, 
				$isNsfw: Boolean
			) {
				getSubredditChildren(
				data: {
					subredditId: $subredditId, 
					iterator: $iterator, 
					filter: $filter, 
					sortBy: $sortBy, 
					limit: $limit, 
					isNsfw: $isNsfw
				}
				) {
				items {
					mediaSources {
					url
					}
				}
				}
			}
		`;


		let iteratorQuery = `
			query SubredditChildrenQuery(
				$subredditId: Int!, 
				$iterator: String, 
				$filter: GalleryFilter, 
				$sortBy: GallerySortBy, 
				$limit: Int!, 
				$isNsfw: Boolean
			) {
				getSubredditChildren(
				data: {
					subredditId: $subredditId, 
					iterator: $iterator, 
					filter: $filter, 
					sortBy: $sortBy, 
					limit: $limit, 
					isNsfw: $isNsfw
				}
				) {
				iterator
				}
			}
		`;

		let query = onlyChapters ? iteratorQuery : imageQuery;

		let payload = JSON.stringify({
			query,
			variables,
			authorization: null
		});

		let request: Request = App.createRequest({
			url: ScrolllerClient.API_URL,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			data: payload
		});

		let response: Response = await requestManager.schedule(request, 1);

		try {
			if (response.status > 300) {
				throw new Error("failure status: " + response.status)
			}
			
			let json = JSON.parse(response.data as string);	
			let items = json?.data?.getSubredditChildren?.items ?? [];
			let iterator = json?.data?.getSubredditChildren?.iterator ?? null;

			if (onlyChapters) {
				return {iterator: iterator, pages: []};
			}

			return {
				iterator: iterator, 
				pages: items
				.filter((item: any) => {
					if (!Array.isArray(item.mediaSources) || item.mediaSources.length === 0) return false;
					let lastUrl = item.mediaSources[item.mediaSources.length - 1].url;
					return typeof lastUrl === 'string' && /\.(png|jpe?g|webp)$/i.test(lastUrl);
				})
				.map((item: any) => item.mediaSources[item.mediaSources.length - 1].url)
			};
		} catch (error) {
			throw new Error("Failed response data: " + response.data + " request: " + payload + " query: " + query)
		}
	}

	public async getDiscoverResultsFor(variables: ScrolllerClient.VariablesObject, requestManager: RequestManager): Promise<ScrolllerClient.SubReddit[]> {
		
		let query = ` query DiscoverFilteredSubredditsQuery(
				$filter: GalleryFilter
				$sortBy: GallerySortBy
				$limit: Int!
				$iterator: String
				$includeFilters: [Int!]
				$excludeFilters: [Int!]
				$isNsfw: Boolean!
			) {
				discoverFilteredSubreddits(
				data: {
					isNsfw: $isNsfw
					filter: $filter
					limit: $limit
					iterator: $iterator
					includeFilters: $includeFilters
					excludeFilters: $excludeFilters
					sortBy: $sortBy
				}
				) {
				items {
					id
					title
					createdAt
					description
					isNsfw
					subscribers
					pictureCount
				}
				}
			}`;

		let payload = JSON.stringify({
			query,
			variables,
			authorization: null
		});

		let request: Request = App.createRequest({
			url: ScrolllerClient.API_URL,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			data: payload
		});

		let response: Response = await requestManager.schedule(request, 1);

		try {
			if (response.status > 300) {
				throw new Error("failure status: " + response.status)
			}
			
			let json = JSON.parse(response.data as string);	
			return json?.data?.discoverFilteredSubreddits?.items ?? [];

		} catch (error) {
			throw new Error("Failed response data: " + response.data + " request: " + payload + " query: " + query)
		}
	}

	async getRedditIdFor(rSlash: string, requestManager: RequestManager): Promise<number> {
		let request: Request = App.createRequest({
			url: "https://scrolller.com/" + rSlash,
			method: "GET",
		});

		let response: Response = await requestManager.schedule(request, 1);

		if (response.status !== 200 || response.data === undefined) {
			throw new Error("request for id failed!");
		}

		// Match Subreddit","id":<number>
		let match = response.data.match(/Subreddit\\",\\"id\\":([^,]*)/);

		if (match) {
			let subredditId = match[1];
			let id = Number.parseInt(subredditId ?? "0", 10);
			if (id === 0 || isNaN(id)) {
				throw new Error("SubReddit ID not found or invalid!");
			}
			return id;
		} else {
			throw new Error("SubReddit ID not found!");
		}
  }

  async getSearchResultsFor(
    variables: ScrolllerClient.VariablesObject,
    requestManager: RequestManager
  ): Promise<ScrolllerClient.SubReddit[]> {
    let query = `query SearchSubredditWithPreview($query: String!, $limit: Int!, $pageIndex: Int!) {
      searchSubredditWithPreview(
        data: { query: $query, limit: $limit, pageIndex: $pageIndex }
      ) {
        isNsfw
        title
        url
      }
    }`;

    let payload = JSON.stringify({
      query,
      variables,
      authorization: null,
    });

    let request: Request = App.createRequest({
      url: ScrolllerClient.API_URL,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: payload,
    });

    let response: Response = await requestManager.schedule(request, 1);

    if (response.status >= 300) {
      throw new Error("failure status: " + response.status);
    }

    let outList: ScrolllerClient.SubReddit[] = [];	

    try {
      let json = JSON.parse(response.data ?? "");
      let subRedditList = json?.data?.searchSubredditWithPreview ?? [];

      for (const sub of subRedditList.slice(0,3)) {
        let gainedId = await this.getRedditIdFor(sub.url, requestManager);
        outList.push({ id: gainedId, title: sub.title, isNsfw: sub.isNsfw });
      }
    } catch (error) {
      throw new Error("Failed Search: " + error);
    }

    return outList;
  }
}

export namespace ScrolllerClient {
	export type VariablesObject = {
		subredditId?: number;
		iterator?: string | null;
		filter?: unknown | null;
		sortBy?: 'RANDOM' | 'NEW' | 'TOP' | 'HOT' | string | null;
		limit?: number;
		isNsfw?: boolean;
		includeFilters?: any[]; 
		excludeFilters?: any[];
		childLimit?: number; 
		query?: string;
		pageIndex?: number;
	};
	export type ImagesResult = {
		iterator?: string | null;
		pages: string[];
	};
	export type SubReddit = {
		id: number;
		title: string | null;
		createdAt?: Date;
		description?: string | null;
		isNsfw: boolean;
		subscribers?: number;
		pictureCount?: number;
		previewUrl?: string;
	};
}
