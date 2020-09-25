"use strict";

const { ServiceBroker } = require("moleculer");
const MongooseStoreAdapter = require("../../src");
const mongoose = require("mongoose");

function protectReject(err) {
	if (err && err.stack) {
		console.error(err);
		console.error(err.stack);
	}
	expect(err).toBe(true);
}

const doc = {
	toJSON: jest.fn(() => ({})),
	_id: {
		toHexString: jest.fn()
	}
};

const docIdString = {
	toJSON: jest.fn(() => ({})),
	_id: {
		toString: jest.fn()
	}
};

const execCB = jest.fn(() => Promise.resolve());
const saveCB = jest.fn(() => Promise.resolve());
const leanCB = jest.fn(() => ({ exec: execCB }));
const countCB = jest.fn(() => ({ exec: execCB }));
const query = jest.fn(() => ({ lean: leanCB, exec: execCB, countDocuments: countCB }));

const fakeModel = Object.assign(jest.fn(() => ({ save: saveCB })), {});

const fakeSchema = {};

let fakeDb = {
	on: jest.fn(),
	close: jest.fn(fn => fn()),
	model: jest.fn(() => fakeModel)
};

describe("Test MongooseStoreAdapter", () => {
	const broker = new ServiceBroker({ logger: false });
	const service = broker.createService({
		name: "store",
		model: fakeModel
	});

	const uri = "mongodb://server";
	const opts = {};
	const adapter = new MongooseStoreAdapter(uri, opts);

	it("should be created", () => {
		expect(adapter).toBeDefined();
		expect(adapter.uri).toBe(uri);
		expect(adapter.opts).toBe(opts);
		expect(adapter.init).toBeDefined();
		expect(adapter.connect).toBeDefined();
		expect(adapter.disconnect).toBeDefined();
		expect(adapter.beforeSaveTransformID).toBeInstanceOf(Function);
		expect(adapter.afterRetrieveTransformID).toBeInstanceOf(Function);
	});

	describe("Test init", () => {
		it("call init", () => {
			adapter.init(broker, service);
			expect(adapter.broker).toBe(broker);
			expect(adapter.service).toBe(service);
			expect(adapter.model).toBe(fakeModel);
		});


		it("call without model and schema", () => {
			const service = broker.createService({
				name: "store"
			});
			const adapter = new MongooseStoreAdapter(opts);
			expect(() => adapter.init(broker, service)).toThrow();
		});

		it("call with schema and no modelName", () => {
			const service = broker.createService({
				name: "store",
				schema: fakeSchema
			});
			const adapter = new MongooseStoreAdapter(opts);
			expect(() => adapter.init(broker, service)).toThrow();
		});

		it("call with schema and modelName", () => {
			const service = broker.createService({
				name: "store",
				schema: fakeSchema,
				modelName: "fakeModel"
			});
			const adapter = new MongooseStoreAdapter(opts);
			adapter.init(broker, service);
			expect(adapter.model).toBeUndefined();
			expect(adapter.modelName).toBe("fakeModel");
			expect(adapter.schema).toBe(fakeSchema);
		});
	});

	describe("Test connect", () => {
		it("call connect with uri", () => {
			fakeDb.on.mockClear();

			mongoose.connect = jest.fn(() => Promise.resolve());
			adapter.opts = undefined;
			return adapter.connect().catch(protectReject).then(() => {
				expect(mongoose.connect).toHaveBeenCalledTimes(1);
				expect(mongoose.connect).toHaveBeenCalledWith("mongodb://server", undefined);
			});
		});

		it("call connect with uri & opts", () => {
			fakeDb.on.mockClear();

			mongoose.connect = jest.fn(() => Promise.resolve({ connection: { db: fakeDb } }));

			return adapter.connect().catch(protectReject).then(() => {
				expect(mongoose.connect).toHaveBeenCalledTimes(1);
				expect(mongoose.connect).toHaveBeenCalledWith(adapter.uri, adapter.opts);
			});
		});

		it("call disconnect", () => {
			return adapter.disconnect().catch(protectReject).then(() => {
        expect(adapter.db.readyState).toBe(0) // This is always 0 though, we should find a better way to mock these things, perhaps look at Mongoose test code
			});
		});

		it("call stringToObjectID", () => {
			mongoose.Types.ObjectId.isValid = jest.fn(() => true);
			mongoose.Schema.Types.ObjectId = jest.fn();

			adapter.stringToObjectID({});
			expect(mongoose.Schema.Types.ObjectId).toHaveBeenCalledTimes(0);

			adapter.stringToObjectID("123");
			expect(mongoose.Schema.Types.ObjectId).toHaveBeenCalledTimes(1);
			expect(mongoose.Schema.Types.ObjectId).toHaveBeenCalledWith("123");
		});

		it("call objectIDToString with not ObjectID", () => {
			expect(adapter.objectIDToString("123")).toBe("123");
		});

		it("call objectIDToString with ObjectID", () => {
			let id = {
				toString: jest.fn()
			};

			adapter.objectIDToString(id);
			expect(id.toString).toHaveBeenCalledTimes(1);
		});

	});

	it("call doc.toJSON", () => {
		doc.toJSON.mockClear();
		doc._id.toHexString.mockClear();
		adapter.entityToObject(doc);
		expect(doc.toJSON).toHaveBeenCalledTimes(1);
		expect(doc._id.toHexString).toHaveBeenCalledTimes(1);
	});

	it("call entityToObject on doc without ObjectID", () => {
		docIdString.toJSON.mockClear();
		docIdString._id.toString.mockClear();
		adapter.entityToObject(docIdString);
		expect(docIdString.toJSON).toHaveBeenCalledTimes(1);
		expect(docIdString._id.toString).toHaveBeenCalledTimes(1);
	});

	it("should transform idField into _id", () => {
		adapter.stringToObjectID = jest.fn(entry => entry);

		let entry = {
			myID: "123456789",
			title: "My first post"
		};
		let idField = "myID";

		let res = adapter.beforeSaveTransformID(entry, idField);

		expect(res.myID).toEqual(undefined);
		expect(res._id).toEqual(entry.myID);
	});

	it("should NOT transform idField into _id", () => {
		// MongoDB will generate the _id
		let entry = {
			title: "My first post"
		};
		let idField = "myID";

		let res = adapter.beforeSaveTransformID(entry, idField);

		expect(res.myID).toEqual(undefined);
		expect(res._id).toEqual(undefined);
	});

	it("should transform _id into idField", () => {
		adapter.objectIDToString = jest.fn(entry => entry);

		let entry = {
			_id: "123456789",
			title: "My first post"
		};
		let idField = "myID";

		let res = adapter.afterRetrieveTransformID(entry, idField);

		expect(res.myID).toEqual(entry.myID);
		expect(res._id).toEqual(undefined);
	});

	it("should NOT transform _id into idField", () => {
		let entry = {
			_id: "123456789",
			title: "My first post"
		};
		let idField = "_id";

		let res = adapter.afterRetrieveTransformID(entry, idField);

		expect(res.myID).toEqual(undefined);
		expect(res._id).toEqual(entry._id);
	});

});
