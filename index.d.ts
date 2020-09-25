declare module "moleculer-db-adapter-mongoose" {
	import { Service, ServiceBroker } from "moleculer";
	import {
		ConnectionBase,
		ConnectionOptions,
		Document,
		DocumentQuery,
		Model,
		Schema
	} from "mongoose";
	import { Db } from "mongodb";

	type HasModelOrSchema<T extends Document> =
		| {
				model: Model<T>;
		  }
		| {
				schema: Schema;
				modelName: string;
		  };

	class MongooseDbAdapter<TDocument extends Document> {
		uri: string;
		opts?: ConnectionOptions;
		broker: ServiceBroker;
		service: Service;
		model: Model<TDocument>;
		schema?: Schema;
		modelName?: string;
		db: Db;
		/**
		 * Creates an instance of MongooseDbAdapter.
		 */
		constructor(uri: string, opts?: ConnectionOptions);
		/**
		 * Initialize adapter
		 */
		init(
			broker: ServiceBroker,
			service: Service & HasModelOrSchema<TDocument>
		): void;
		/**
		 * Connect to database
		 */
		connect(): Promise<void>;
		/**
		 * Disconnect from database
		 */
		disconnect(): Promise<void>;
		/**
		 * Convert DB entity to JSON object
		 */
		entityToObject(entity: any): any;
	}
	export = MongooseDbAdapter;
}
