/**
 * We don't have an insights web service set up yet. So for the time being we are loading the database
 * schema from the local schema.json file.
 */

/// <reference path = "../../InsightsParser_Bridge/Kusto.Language.Bridge.d.ts" />
/// <reference path="./typings/MissingFromBridge.d.ts" />
/// <reference path="./typings/refs.d.ts" />
import './bridge.min';
import './Kusto.Language.Bridge.min';

let defaultDatabase:any;

export default function getGlobalState(): Kusto.Language.GlobalState
{
	try
	{
		var obj:any = require("../schema.json");
	}
	catch(e)
	{
		return null;
	}

	return Kusto.Language.GlobalState.Default.WithCluster(getCluster(obj.cluster)).WithDatabase(defaultDatabase);
	
}

function getCluster(cluster: any):Kusto.Language.Symbols.ClusterSymbol
{
	let database_list = [];
	for(var i=0; i<cluster.databases.length; ++i)
	{
		database_list.push(getDatabase(cluster.databases[i]));
	}

	defaultDatabase = database_list[0];

	return new Kusto.Language.Symbols.ClusterSymbol.ctor(cluster.name, database_list);
}

function getDatabase(database: any):Kusto.Language.Symbols.DatabaseSymbol
{
	var table_list:any[] = [];
	for(var i=0; i<database.tables.length; ++i)
	{
		table_list.push(getTable(database.tables[i]));
	}
	
	return new Kusto.Language.Symbols.DatabaseSymbol.ctor(database.name, table_list);
}

function getTable(table: any):Kusto.Language.Symbols.TableSymbol
{
	var column_list: any = [];
	for(var i=0; i<table.columns.length; ++i)
	{
		column_list.push(getColumn(table.columns[i]));
	}

	return new Kusto.Language.Symbols.TableSymbol.$ctor5(table.name, column_list, "");
}

function getColumn(column: any): Kusto.Language.Symbols.ColumnSymbol
{
	if(column.type == "bool")
	{
		return new Kusto.Language.Symbols.ColumnSymbol(column.name, Kusto.Language.Symbols.ScalarTypes.Bool, "", column.identity);
	}
	else if(column.type == "int")
	{
		return new Kusto.Language.Symbols.ColumnSymbol(column.name, Kusto.Language.Symbols.ScalarTypes.Int, "", column.identity);
	}
	else if(column.type == "long")
	{
		return new Kusto.Language.Symbols.ColumnSymbol(column.name, Kusto.Language.Symbols.ScalarTypes.Long, "", column.identity);
	}
	else if(column.type == "real")
	{
		return new Kusto.Language.Symbols.ColumnSymbol(column.name, Kusto.Language.Symbols.ScalarTypes.Real, "", column.identity);
	}
	else if(column.type == "decimal")
	{
		return new Kusto.Language.Symbols.ColumnSymbol(column.name, Kusto.Language.Symbols.ScalarTypes.Decimal, "", column.identity);
	}
	else if(column.type == "datetime" || column.type == 'datetimeoffset')
	{
		return new Kusto.Language.Symbols.ColumnSymbol(column.name, Kusto.Language.Symbols.ScalarTypes.DateTime, "", column.identity);
	}
	else if(column.type == "timespan")
	{
		return new Kusto.Language.Symbols.ColumnSymbol(column.name, Kusto.Language.Symbols.ScalarTypes.TimeSpan, "", column.identity);
	}
	else if(column.type == "guid")
	{
		return new Kusto.Language.Symbols.ColumnSymbol(column.name, Kusto.Language.Symbols.ScalarTypes.Guid, "", column.identity);
	}
	else if(column.type == "type")
	{
		return new Kusto.Language.Symbols.ColumnSymbol(column.name, Kusto.Language.Symbols.ScalarTypes.Type, "", column.identity);
	}
	else if(column.type == "dynamic")
	{
		return new Kusto.Language.Symbols.ColumnSymbol(column.name, Kusto.Language.Symbols.ScalarTypes.Dynamic, "", column.identity);
	}
	else if(column.type == "string")
	{
		return new Kusto.Language.Symbols.ColumnSymbol(column.name, Kusto.Language.Symbols.ScalarTypes.String, "", column.identity);
	}
	console.log("Can't recognize type of \'" + column.name + "\': " + column.type);
	return null;
}