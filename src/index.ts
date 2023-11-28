// Importing necessary modules from the 'azle' library and 'uuid' library
import {
  $query,
  $update,
  Record,
  StableBTreeMap,
  Vec,
  match,
  Result,
  nat64,
  ic,
  Opt,
  Principal,
  Variant,
} from "azle";
import { v4 as uuidv4 } from "uuid";

// Represents the priority levels for a code ticket.
type CodeTicketPriority = Variant<{
  High: null;
  Medium: null;
  Low: null;
}>;

// Represents the possible status values that a code ticket can have.
type CodeTicketStatus = Variant<{
  in_progress: null;
  completed: null;
  in_review: null;
  assigned: null;
  deferred: null;
  rejected: null;
}>;

// Represents a code ticket record with various properties.
type CodeTicket = Record<{
  id: string;
  title: string;
  description: string;
  status: Opt<CodeTicketStatus>;
  priority: CodeTicketPriority;
  assigned_to: string;
  author: Principal;
  created_at: nat64;
  updated_at: Opt<nat64>;
  comments: Opt<string>;
  due_date: string;
}>;

// Represents the payload for creating a new code ticket.
type CreateCodeTicket = Record<{
  title: string;
  description: string;
  priority: CodeTicketPriority;
  assigned_to: string;
  comments: Opt<string>;
  due_date: string;
  status: Opt<CodeTicketStatus>;
}>;

// Represents the payload for updating a code ticket as the author.
type UpdateCodeTicketAsAuthor = Record<{
  title: string;
  description: string;
  status: Opt<CodeTicketStatus>;
  priority: CodeTicketPriority;
  comments: Opt<string>;
  due_date: string;
}>;

// Represents the payload for updating a code ticket as the assignee.
type UpdateCodeTicketAsAssignee = Record<{
  status: Opt<CodeTicketStatus>;
  comments: Opt<string>;
}>;

// Represents the storage for code tickets using a StableBTreeMap, as recommended.
const codeTicketStorage = new StableBTreeMap<string, CodeTicket>(0, 44, 1024);

// The number of code tickets to load initially.
const initialLoadSize = 5;

// Creates a new code ticket.
$update;
export function createCodeTicket(
  model: CreateCodeTicket
): Result<CodeTicket, string> {
  try {
    // Validate payload
    if (
      !model.assigned_to ||
      !model.description ||
      !model.priority ||
      !model.title ||
      !model.due_date
    ) {
      throw new Error("Can not create code ticket with invalid payload");
    }

    // Create and insert a new code ticket
    const codeTicket: CodeTicket = {
      id: uuidv4(),
      title: model.title,
      description: model.description,
      status: model.status,
      priority: model.priority,
      assigned_to: model.assigned_to,
      due_date: model.due_date,
      author: ic.caller(),
      created_at: ic.time(),
      updated_at: Opt.None,
      comments: Opt.None,
    };
    codeTicketStorage.insert(codeTicket.id, codeTicket);

    return Result.Ok<CodeTicket, string>(codeTicket);
  } catch (error: any) {
    // Handle any errors that may occur
    return Result.Err<CodeTicket, string>(error?.message);
  }
}

// Retrieves the first few code tickets.
$query;
export function getFirstCodeTickets(): Result<Vec<CodeTicket>, string> {
  try {
    // Return a slice of the initial code tickets
    return Result.Ok(codeTicketStorage.values().slice(0, initialLoadSize));
  } catch (error: any) {
    // Handle any errors that may occur
    return Result.Err(error?.message);
  }
}

// Retrieves all code tickets.
$query;
export function getAllCodeTickets(): Result<Vec<CodeTicket>, string> {
  try {
    // Return all code tickets
    return Result.Ok(codeTicketStorage.values());
  } catch (error: any) {
    // Handle any errors that may occur
    return Result.Err(error?.message);
  }
}

// Retrieves a paginated list of code tickets.
$query;
export function getPaginatedCodeTickets(
  offset: number,
  limit: number
): Result<Vec<CodeTicket>, string> {
  try {
    // Return a paginated list of code tickets
    return Result.Ok(
      codeTicketStorage.values().slice(offset, offset + limit)
    );
  } catch (error: any) {
    // Handle any errors that may occur
    return Result.Err(error?.message);
  }
}

// Finds a code ticket by its ID.
$query;
export function findCodeTicketById(id: string): Result<CodeTicket, string> {
  try {
    // Validate ID
    if (typeof id !== "string") {
      throw new Error("Can not query code tickets with invalid id");
    }

    return match(codeTicketStorage.get(id), {
      Some: (codeTicket) => {
        // Validate authorization
        const callerIdentity = ic.caller().toString();

        if (callerIdentity !== codeTicket.author.toString()) {
          throw new Error("Unauthorized");
        }

        return Result.Ok<CodeTicket, string>(codeTicket);
      },
      None: () => {
        throw new Error(`Code ticket with id = ${id} not found.`);
      },
    });
  } catch (error: any) {
    // Handle any errors that may occur
    return Result.Err(error?.message);
  }
}

// Queries code tickets by keyword search.
$query;
export function queryCodeTicketsByKeyword(
  keywords: string
): Result<Vec<CodeTicket>, string> {
  try {
    // Convert keywords to lowercase
    keywords = keywords.toLowerCase();

    // Return code tickets matching the keyword search
    return Result.Ok(
      codeTicketStorage
        .values()
        .filter(
          (ticket) =>
            ticket.description.includes(keywords) ||
            ticket.title.includes(keywords)
        )
    );
  } catch (error: any) {
    // Handle any errors that may occur
    return Result.Err(error?.message);
  }
}

// Retrieves the first code ticket matching the keyword search.
$query;
export function getOneCodeTicketByKeyword(
  keywords: string
): Result<CodeTicket, string> {
  try {
    // Convert keywords to lowercase
    keywords = keywords.toLowerCase();

    // Filter code tickets by keyword search and return the first one
    const codeTickets = codeTicketStorage
      .values()
      .filter(
        (ticket) =>
          ticket.description.includes(keywords) ||
          ticket.title.includes(keywords)
      );

    return Result.Ok(codeTickets[0]);
  } catch (error: any) {
    // Handle any errors that may occur
    return Result.Err(error?.message);
  }
}

// Finds code tickets by their status.
$query;
export function findCodeTicketsByStatus(
  status: Opt<CodeTicketStatus>
): Result<Vec<CodeTicket>, string> {
  try {
    // Validate status
    if (!status) {
      throw new Error("Cannot query using invalid code ticket status");
    }

    // Extract status key
    const statusKey = Object.keys(status)[0];

    // Filter code tickets by status and return the result
    const codeTicketByStatus = codeTicketStorage.values().filter((ticket) => {
      const ticketStatusKey = Object.keys(ticket.status)[0];
      return ticketStatusKey === statusKey;
    });

    return Result.Ok(codeTicketByStatus);
  } catch (error: any) {
    // Handle any errors that may occur
    return Result.Err(error?.message);
  }
}

// Finds code tickets by their priority.
$query;
export function findCodeTicketsByPriority(
  priority: CodeTicketPriority
): Result<Vec<CodeTicket>, string> {
  try {
    // Validate priority
    if (!priority) {
      throw new Error("Cannot query using invalid code ticket priority");
    }

    // Extract priority key
    const priorityKey = Object.keys(priority)[0];

    // Filter code tickets by priority and return the result
    const codeTicketByPriority = codeTicketStorage.values().filter((ticket) => {
      const ticketPriorityKey = Object.keys(ticket.priority)[0];
      return ticketPriorityKey === priorityKey;
    });

    return Result.Ok(codeTicketByPriority);
  } catch (error: any) {
    // Handle any errors that may occur
    return Result.Err(error?.message);
  }
}

// Deletes a code ticket.
$update;
export function deleteCodeTicket(id: string): Result<CodeTicket, string> {
  try {
    // Validate ID
    if (typeof id !== "string") {
      return Result.Err<CodeTicket, string>("Invalid Id Parameter");
    }
    // Use match to handle Some and None cases
    return match(codeTicketStorage.get(id), {
      Some: (ticket: CodeTicket) => {
        // Validate authorization
        if (ticket.author.toString() === ic.caller().toString()) {
          // Remove the code ticket
          codeTicketStorage.remove(id);
          return Result.Ok<CodeTicket, string>(ticket);
        }

        return Result.Err<CodeTicket, string>("Unauthorized");
      },
      None: () => {
        return Result.Err<CodeTicket, string>(
          `Code ticket with id ${id} not found`
        );
      },
    });
  } catch (error: any) {
    // Handle any errors that may occur
    return Result.Err<CodeTicket, string>(error?.message);
  }
}

// Updates a code ticket STRICTLY as the author.
$update;
export function updateCodeTicketAsAuthor(
  id: string,
  model: UpdateCodeTicketAsAuthor
): Result<CodeTicket, string> {
  try {
    // Validate ID
    if (typeof id !== "string") {
      return Result.Err<CodeTicket, string>("Invalid Id Parameter");
    }
    // Use match to handle Some and None cases
    return match(codeTicketStorage.get(id), {
      Some: (ticket: CodeTicket) => {
        // Validate authorization
        const callerIdentity = ic.caller().toString();

        if (callerIdentity !== ticket.author.toString()) {
          throw new Error("Unauthorized");
        }

        // Update the code ticket
        const updatedCodeTicket: CodeTicket = {
          ...ticket,
          ...model,
          updated_at: Opt.Some(ic.time()),
        };
        codeTicketStorage.insert(id, updatedCodeTicket);

        return Result.Ok<CodeTicket, string>(updatedCodeTicket);
      },
      None: () => {
        throw new Error(`Code ticket with id ${id} not found`);
      },
    });
  } catch (error: any) {
    // Handle any errors that may occur
    return Result.Err<CodeTicket, string>(error?.message);
  }
}

// Updates a code ticket STRICTLY as the assignee.
$update;
export function updateCodeTicketAsAssignee(
  id: string,
  model: UpdateCodeTicketAsAssignee
): Result<CodeTicket, string> {
  try {
    // Validate ID
    if (typeof id !== "string") {
      return Result.Err<CodeTicket, string>("Invalid Id Parameter");
    }
    // Use match to handle Some and None cases
    return match(codeTicketStorage.get(id), {
      Some: (ticket: CodeTicket) => {
        // Validate authorization
        if (ic.caller.toString() !== ticket.assigned_to.toString()) {
          throw new Error("Unauthorized");
        }

        // Update the code ticket
        const updatedCodeTicket: CodeTicket = {
          ...ticket,
          ...model,
          updated_at: Opt.Some(ic.time()),
        };
        codeTicketStorage.insert(id, updatedCodeTicket);

        return Result.Ok<CodeTicket, string>(updatedCodeTicket);
      },
      None: () => {
        throw new Error(`Code ticket with id ${id} not found`);
      },
    });
  } catch (error: any) {
    // Handle any errors that may occur
    return Result.Err<CodeTicket, string>(error?.message);
  }
}

// UUID workaround
globalThis.crypto = {
  // @ts-ignore
  getRandomValues: () => {
    let array = new Uint8Array(32);

    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }

    return array;
  },
};
