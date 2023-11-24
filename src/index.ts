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
} from "azle";
import { v4 as uuidv4 } from "uuid";

// Represents the priority levels for a code ticket.
type CodeTicketPriority = "high" | "medium" | "low";

// Represents the possible status values that a code ticket can have.
type CodeTicketStatus =
  | "in_progress"
  | "completed"
  | "in_review"
  | "assigned"
  | "deferred"
  | "rejected";

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

// Represents a collection of code tickets.
type CodeTickets = Vec<CodeTicket>;

// Represents the payload for creating a new code ticket.
type CreateCodeTicket = Record<{
  title: string;
  description: string;
  priority: CodeTicketPriority;
  assigned_to: string;
  comments: Opt<string>;
  due_date: string;
}>;

// Represents the payload for updating a code ticket as the author.
type UpdateCodeTicketAsAuthor = Record<
  Partial<{
    title: string;
    description: string;
    status: Opt<CodeTicketStatus>;
    priority: CodeTicketPriority;
    comments: Opt<string>;
    due_date: string;
  }>
>;

// Represents the payload for updating a code ticket as the assignee.
type UpdateCodeTicketAsAssignee = Record<
  Partial<{
    status: Opt<CodeTicketStatus>;
    comments: Opt<string>;
  }>
>;

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
    if (
      !model.assigned_to ||
      !model.description ||
      !model.priority ||
      !model.title
    ) {
      throw new Error("Can not create code ticket with invalid payload");
    }

    if (isNaN(new Date(model.due_date).getTime())) {
      throw new Error("can not create code ticket with invalid due date");
    }

    const codeTicket: CodeTicket = {
      id: uuidv4(),
      title: model.title,
      description: model.description,
      status: Opt.None,
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
    return Result.Err<CodeTicket, string>(error?.message);
  }
}

// Retrieves the first few code tickets.
$query;
export function getFirstCodeTickets(): Result<CodeTickets, string> {
  return Result.Ok(codeTicketStorage.values().slice(0, initialLoadSize));
}

// Retrieves all code tickets.
$query;
export function getAllCodeTickets(): Result<CodeTickets, string> {
  return Result.Ok(codeTicketStorage.values());
}

// Retrieves a paginated list of code tickets.
$query;
export function getPaginatedCodeTickets(
  offset: number,
  limit: number
): Result<CodeTickets, string> {
  return Result.Ok(codeTicketStorage.values().slice(offset, offset + limit));
}

// Finds a code ticket by its ID.
$query;
export function findCodeTicketById(id: string): Result<CodeTicket, string> {
  try {
    if (typeof id !== "string") {
      throw new Error("Can not query code tickets with invalid id");
    }

    return match(codeTicketStorage.get(id), {
      Some: (codeTicket) => {
        const callerIdentity = ic.caller().toString();

        if (
          callerIdentity !== codeTicket.author.toString() ||
          callerIdentity !== codeTicket.assigned_to
        ) {
          throw new Error("Unauthorized");
        }

        return Result.Ok<CodeTicket, string>(codeTicket);
      },
      None: () => {
        throw new Error(`Code ticket with id = ${id} not found.`);
      },
    });
  } catch (error: any) {
    return Result.Err(error?.message);
  }
}

// Queries code tickets by keyword search.
$query;
export function queryCodeTicketsByKeyword(
  keywords: string
): Result<CodeTickets, string> {
  keywords = keywords.toLowerCase();

  return Result.Ok(
    codeTicketStorage
      .values()
      .filter(
        (ticket) =>
          ticket.description.includes(keywords) ||
          ticket.title.includes(keywords)
      )
  );
}

// Retrieves the first code ticket matching the keyword search.
$query;
export function getOneCodeTicketByKeyword(
  keywords: string
): Result<CodeTicket, string> {
  keywords = keywords.toLowerCase();
  const codeTickets = codeTicketStorage
    .values()
    .filter(
      (ticket) =>
        ticket.description.includes(keywords) || ticket.title.includes(keywords)
    );

  return Result.Ok(codeTickets[0]);
}

// Finds code tickets by their status.
$query;
export function findCodeTicketsByStatus(
  status: Opt<CodeTicketStatus>
): Result<CodeTickets, string> {
  if (!status) {
    return Result.Err("Can not query using invalid code ticket status");
  }

  return Result.Ok(
    codeTicketStorage.values().filter((ticket) => ticket.status === status)
  );
}

// Finds code tickets by their priority.
$query;
export function findCodeTicketsByPriority(
  priority: CodeTicketPriority
): Result<CodeTickets, string> {
  if (!priority) {
    return Result.Err("Can not query using invalid code ticket priority");
  }

  return Result.Ok(
    codeTicketStorage.values().filter((ticket) => ticket.priority === priority)
  );
}

// Deletes a code ticket.
$update;
export function deleteCodeTicket(id: string): Result<CodeTicket, string> {
  return match(codeTicketStorage.get(id), {
    Some: (ticket: CodeTicket) => {
      if (ticket.author.toString() === ic.caller().toString()) {
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
}

// Updates a code ticket STRICTLY as the author.
$update;
export function updateCodeTicketAsAuthor(
  id: string,
  model: UpdateCodeTicketAsAuthor
): Result<CodeTicket, string> {
  try {
    return match(codeTicketStorage.get(id), {
      Some: (ticket: CodeTicket) => {
        if (ic.caller.toString() === ticket.author.toString()) {
          const updatedCodeTicket: CodeTicket = {
            ...ticket,
            ...model,
            updated_at: Opt.Some(ic.time()),
          };
          codeTicketStorage.insert(id, updatedCodeTicket);

          return Result.Ok<CodeTicket, string>(updatedCodeTicket);
        }

        throw new Error("Unauthorized");
      },
      None: () => {
        throw new Error(`Code ticket with id ${id} not found`);
      },
    });
  } catch (error: any) {
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
    return match(codeTicketStorage.get(id), {
      Some: (ticket: CodeTicket) => {
        if (ic.caller.toString() === ticket.assigned_to) {
          const updatedCodeTicket: CodeTicket = {
            ...ticket,
            ...model,
            updated_at: Opt.Some(ic.time()),
          };
          codeTicketStorage.insert(id, updatedCodeTicket);

          return Result.Ok<CodeTicket, string>(updatedCodeTicket);
        }

        throw new Error("Unauthorized");
      },
      None: () => {
        throw new Error(`Code ticket with id ${id} not found`);
      },
    });
  } catch (error: any) {
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
