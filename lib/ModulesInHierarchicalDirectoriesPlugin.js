/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/

"use strict";

const forEachBail = require("./forEachBail");
const getPaths = require("./getPaths");

/** @typedef {import("./Resolver")} Resolver */
/** @typedef {import("./Resolver").ResolveStepHook} ResolveStepHook */

module.exports = class ModulesInHierarchicalDirectoriesPlugin {
	/**
	 * @param {string | ResolveStepHook} source source
	 * @param {string | Array<string>} directories directories
	 * @param {string | ResolveStepHook} target target
	 */
	constructor(source, directories, target) {
		this.source = source;
		this.directories = /** @type {Array<string>} */ ([]).concat(directories);
		this.target = target;
	}

	/**
	 * @param {Resolver} resolver the resolver
	 * @returns {void}
	 */
	apply(resolver) {
		const target = resolver.ensureHook(this.target);
		resolver
			.getHook(this.source)
			.tapAsync(
				"ModulesInHierarchicalDirectoriesPlugin",
				(request, resolveContext, callback) => {
					const fs = resolver.fileSystem;
					const addrs = getPaths(request.path)
						.paths.map(p => {
							return this.directories.map(d => resolver.join(p, d));
						})
						.reduce((array, p) => {
							array.push.apply(array, p);
							return array;
						}, []);
					forEachBail(
						addrs,
						(addr, callback) => {
							fs.stat(addr, { throwIfNoEntry: false }, (err, stat) => {
								if (!err && stat && stat.isDirectory()) {
									const obj = {
										...request,
										path: addr,
										request: "./" + request.request,
										module: false
									};
									const message = "looking for modules in " + addr;
									return resolver.doResolve(
										target,
										obj,
										message,
										resolveContext,
										callback
									);
								}
								if (resolveContext.log)
									resolveContext.log(
										addr + " doesn't exist or is not a directory"
									);
								if (resolveContext.missingDependencies)
									resolveContext.missingDependencies.add(addr);
								return callback();
							});
						},
						callback
					);
				}
			);
	}
};
