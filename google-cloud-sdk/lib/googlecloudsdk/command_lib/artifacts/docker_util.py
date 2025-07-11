# -*- coding: utf-8 -*- #
# Copyright 2020 Google LLC. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""Utility for interacting with `artifacts docker` command group."""

from __future__ import absolute_import
from __future__ import division
from __future__ import unicode_literals

import re

from apitools.base.py import exceptions as api_exceptions
from googlecloudsdk.api_lib.artifacts import exceptions as ar_exceptions
from googlecloudsdk.api_lib.util import common_args
from googlecloudsdk.api_lib.util import waiter
from googlecloudsdk.command_lib.artifacts import containeranalysis_util as ca_util
from googlecloudsdk.command_lib.artifacts import requests as ar_requests
from googlecloudsdk.command_lib.artifacts import util
from googlecloudsdk.core import log
from googlecloudsdk.core import properties
from googlecloudsdk.core import resources
from googlecloudsdk.core.console import console_io


ARTIFACTREGISTRY_API_NAME = "artifactregistry"

_INVALID_IMAGE_PATH_ERROR = """Invalid Docker string.

A valid Docker repository has the format of
  LOCATION-docker.DOMAIN/PROJECT-ID/REPOSITORY-ID

A valid image has the format of
  LOCATION-docker.DOMAIN/PROJECT-ID/REPOSITORY-ID/IMAGE
"""

_INVALID_DEFAULT_DOCKER_STRING_ERROR = (
    """Fail to construct Docker string from config values:
core/project: {project}, artifacts/location: {location}, artifacts/repository: {repo}

A valid Docker repository has the format of
  LOCATION-docker.DOMAIN/PROJECT-ID/REPOSITORY-ID

A valid image has the format of
  LOCATION-docker.DOMAIN/PROJECT-ID/REPOSITORY-ID/IMAGE
""")

_INVALID_IMAGE_ERROR = """Invalid Docker image.

A valid container image has the format of
  LOCATION-docker.DOMAIN/PROJECT-ID/REPOSITORY-ID/IMAGE

A valid container image that can be referenced by tag or digest, has the format of
  LOCATION-docker.DOMAIN/PROJECT-ID/REPOSITORY-ID/IMAGE:tag
  LOCATION-docker.DOMAIN/PROJECT-ID/REPOSITORY-ID/IMAGE@sha256:digest
"""

_INVALID_VERSION_STR_ERROR = """Invalid Docker image/Version.

A valid container image that can be referenced by tag or digest, has the format of
  projects/PROJECT-ID/locations/LOCATION/repositories/REPOSITORY-ID/packages/PACKAGE-ID/versions/sha256:digest
  LOCATION-docker.DOMAIN/PROJECT-ID/REPOSITORY-ID/IMAGE:tag
  LOCATION-docker.DOMAIN/PROJECT-ID/REPOSITORY-ID/IMAGE@sha256:digest
"""

_INVALID_DOCKER_IMAGE_ERROR = """Invalid Docker image.

A valid container image can be referenced by tag or digest, has the format of
  LOCATION-docker.DOMAIN/PROJECT-ID/REPOSITORY-ID/IMAGE:tag
  LOCATION-docker.DOMAIN/PROJECT-ID/REPOSITORY-ID/IMAGE@sha256:digest
"""

_INVALID_DOCKER_TAG_ERROR = """Invalid Docker tag.

A valid Docker tag has the format of
  LOCATION-docker.DOMAIN/PROJECT-ID/REPOSITORY-ID/IMAGE:tag
"""

_DOCKER_IMAGE_NOT_FOUND = """Image not found.

A valid container image can be referenced by tag or digest, has the format of
  LOCATION-docker.DOMAIN/PROJECT-ID/REPOSITORY-ID/IMAGE:tag
  LOCATION-docker.DOMAIN/PROJECT-ID/REPOSITORY-ID/IMAGE@sha256:digest
"""


GCR_DOCKER_REPO_REGEX = r"^(?P<repo>(us\.|eu\.|asia\.)?gcr.io)\/(?P<project>[^\/\.]+)\/(?P<image>.*)"

# For domain scoped repos, the project is two segments long instead of one
GCR_DOCKER_DOMAIN_SCOPED_REPO_REGEX = r"^(?P<repo>(us\.|eu\.|asia\.)?gcr.io)\/(?P<project>[^\/]+\.[^\/]+\/[^\/]+)\/(?P<image>.*)"

DOCKER_REPO_REGEX = r"^(?P<location>.*)[.-]docker.(?P<domain>{})\/(?P<project>[^\/]+)\/(?P<repo>[^\/]+)".format(
    properties.VALUES.artifacts.domain.Get()
)

DOCKER_IMG_BY_TAG_REGEX = (
    r"^.*[.-]docker.(?P<domain>{})\/[^\/]+\/[^\/]+\/(?P<img>.*):(?P<tag>.*)"
    .format(properties.VALUES.artifacts.domain.Get())
)

DOCKER_IMG_BY_DIGEST_REGEX = r"^.*[.-]docker.(?P<domain>{})\/[^\/]+\/[^\/]+\/(?P<img>.*)@(?P<digest>sha256:.*)".format(
    properties.VALUES.artifacts.domain.Get()
)

DOCKER_IMG_REGEX = (
    r"^.*[.-]docker.(?P<domain>{})\/[^\/]+\/[^\/]+\/(?P<img>.*)".format(
        properties.VALUES.artifacts.domain.Get()
    )
)

_VERSION_COLLECTION_NAME = (
    "artifactregistry.projects.locations.repositories.packages.versions"
)

_VERSION_REGEX = r"projects\/(?P<project>[^\/]+)\/locations\/(?P<location>[^\/]+)\/repositories\/(?P<repository>[^\/]+)\/packages\/(?P<package>.+)\/versions\/(?P<version>[^\/]+)$"

DOCKER_URI_REGEX = r"https://(?P<docker_string>.*(docker\.pkg\.dev|gcr\.io).*)"


def _GetDefaultResources():
  """Gets default config values for project, location, and repository."""
  project = properties.VALUES.core.project.Get()
  location = properties.VALUES.artifacts.location.Get()
  repo = properties.VALUES.artifacts.repository.Get()
  if not project or not location or not repo:
    raise ar_exceptions.InvalidInputValueError(
        _INVALID_DEFAULT_DOCKER_STRING_ERROR.format(**{
            "project": project,
            "location": location,
            "repo": repo,
        }))
  return DockerRepo(project, location, repo)


def _ParseInput(input_str):
  """Parses user input into project, location, and repository values.

  Args:
    input_str: str, user input. Ex: us-docker.pkg.dev/my-proj/my-repo/my-img

  Raises:
    ar_exceptions.InvalidInputValueError if user input is invalid.
    ar_exceptions.UnsupportedLocationError if provided location is invalid.

  Returns:
    A DockerRepo.
  """
  # To support testing in staging, we have to check if artifact registry
  # endpoints have a prefix and if so remove them before making API
  # calls to artifact registy.
  prefix = properties.VALUES.artifacts.registry_endpoint_prefix.Get()
  prefix = re.escape(prefix)
  regex = "^" + prefix + DOCKER_REPO_REGEX[1:]
  matches = re.match(regex, input_str)
  if not matches:
    raise ar_exceptions.InvalidInputValueError()
  location = matches.group("location")
  project_id = matches.group("project")
  return DockerRepo(project_id, location, matches.group("repo"))


def ParseDockerImagePath(img_path):
  """Validates and parses an image path into a DockerImage or a DockerRepo."""
  if not img_path:
    return _GetDefaultResources()

  resource_val_list = list(filter(None, img_path.split("/")))
  try:
    docker_repo = _ParseInput(img_path)
  except ar_exceptions.InvalidInputValueError:
    raise ar_exceptions.InvalidInputValueError(_INVALID_IMAGE_PATH_ERROR)

  if len(resource_val_list) == 3:
    return docker_repo
  elif len(resource_val_list) > 3:
    return DockerImage(docker_repo, "/".join(resource_val_list[3:]))
  raise ar_exceptions.InvalidInputValueError(_INVALID_IMAGE_PATH_ERROR)


def _ParseDockerImage(img_str, err_msg, strict=True):
  """Validates and parses an image string into a DockerImage.

  Args:
    img_str: str, User input docker formatted string.
    err_msg: str, Error message to return to user.
    strict: bool, If False, defaults tags to "latest".

  Raises:
    ar_exceptions.InvalidInputValueError if user input is invalid.
    ar_exceptions.UnsupportedLocationError if provided location is invalid.

  Returns:
    A DockerImage, and a DockerTag or a DockerVersion.
  """
  try:
    docker_repo = _ParseInput(img_str)
  except ar_exceptions.InvalidInputValueError:
    raise ar_exceptions.InvalidInputValueError(_INVALID_DOCKER_IMAGE_ERROR)

  img_by_digest_match = re.match(DOCKER_IMG_BY_DIGEST_REGEX, img_str)
  if img_by_digest_match:
    docker_img = DockerImage(docker_repo, img_by_digest_match.group("img"))
    return docker_img, DockerVersion(docker_img,
                                     img_by_digest_match.group("digest"))
  img_by_tag_match = re.match(DOCKER_IMG_BY_TAG_REGEX, img_str)
  if img_by_tag_match:
    docker_img = DockerImage(docker_repo, img_by_tag_match.group("img"))
    return docker_img, DockerTag(docker_img, img_by_tag_match.group("tag"))
  whole_img_match = re.match(DOCKER_IMG_REGEX, img_str)
  if whole_img_match:
    docker_img = DockerImage(docker_repo,
                             whole_img_match.group("img").strip("/"))
    return docker_img, None if strict else DockerTag(docker_img, "latest")
  raise ar_exceptions.InvalidInputValueError(err_msg)


def ParseDockerVersionStr(version_str):
  """Validates and parses an image string into a DockerImage.

  Args:
    version_str: str, User input docker formatted or AR version resource string.

  Raises:
    ar_exceptions.InvalidInputValueError if user input is invalid.
    ar_exceptions.UnsupportedLocationError if provided location is invalid.

  Returns:
    A DockerVersion.
  """
  # Resource collection parser cannot be used for resource path with packages
  # containing unescaped "/".
  match = re.match(_VERSION_REGEX, version_str)
  if match:
    return DockerVersion(
        DockerImage(
            DockerRepo(
                match.group("project"),
                match.group("location"),
                match.group("repository"),
            ),
            util.EscapePackageStr(match.group("package")),
        ),
        match.group("version"),
    )

  try:
    docker_repo = _ParseInput(version_str)
  except ar_exceptions.InvalidInputValueError:
    raise ar_exceptions.InvalidInputValueError(_INVALID_VERSION_STR_ERROR)

  uri_digest_match = re.match(DOCKER_IMG_BY_DIGEST_REGEX, version_str)
  uri_tag_match = re.match(DOCKER_IMG_BY_TAG_REGEX, version_str)

  if uri_digest_match:
    docker_img = DockerImage(docker_repo, uri_digest_match.group("img"))
    return DockerVersion(docker_img, uri_digest_match.group("digest"))
  elif uri_tag_match:
    docker_img = DockerImage(docker_repo, uri_tag_match.group("img"))
    tag = DockerTag(docker_img, uri_tag_match.group("tag"))
    return _ValidateAndGetDockerVersion(tag)

  raise ar_exceptions.InvalidInputValueError(_INVALID_VERSION_STR_ERROR)


def _ParseDockerTag(tag):
  """Validates and parses a tag string.

  Args:
    tag: str, User input Docker tag string.

  Raises:
    ar_exceptions.InvalidInputValueError if user input is invalid.
    ar_exceptions.UnsupportedLocationError if provided location is invalid.

  Returns:
    A DockerImage and a DockerTag.
  """
  try:
    docker_repo = _ParseInput(tag)
  except ar_exceptions.InvalidInputValueError:
    raise ar_exceptions.InvalidInputValueError(_INVALID_DOCKER_TAG_ERROR)

  img_by_tag_match = re.match(DOCKER_IMG_BY_TAG_REGEX, tag)
  if img_by_tag_match:
    docker_img = DockerImage(docker_repo, img_by_tag_match.group("img"))
    return docker_img, DockerTag(docker_img, img_by_tag_match.group("tag"))
  else:
    raise ar_exceptions.InvalidInputValueError(_INVALID_DOCKER_TAG_ERROR)


def _GetDockerPackagesAndVersions(docker_repo,
                                  include_tags,
                                  page_size,
                                  order_by,
                                  limit,
                                  package_prefix=""):
  """Gets a list of packages with versions for a Docker repository."""
  client = ar_requests.GetClient()
  messages = ar_requests.GetMessages()
  img_list = []
  for pkg in ar_requests.ListPackages(
      client, messages, docker_repo.GetRepositoryName(), page_size=page_size):
    parts = pkg.name.split("/")
    if len(parts) != 8:
      raise ar_exceptions.ArtifactRegistryError(
          "Internal error. Corrupted package name: {}".format(pkg.name))
    img = DockerImage(DockerRepo(parts[1], parts[3], parts[5]), parts[7])
    if package_prefix and not img.GetDockerString().startswith(package_prefix):
      continue
    img_list.extend(
        _GetDockerVersions(
            img, include_tags, page_size, order_by, limit,
            search_subdirs=False))
  return img_list


def _GetDockerVersions(docker_img,
                       include_tags,
                       page_size=None,
                       order_by=None,
                       limit=None,
                       search_subdirs=False):
  """Gets a list of versions for a Docker image."""
  client = ar_requests.GetClient()
  messages = ar_requests.GetMessages()
  ver_view = (
      messages
      .ArtifactregistryProjectsLocationsRepositoriesPackagesVersionsListRequest
      .ViewValueValuesEnum.BASIC)
  if include_tags:
    ver_view = (
        messages.
        ArtifactregistryProjectsLocationsRepositoriesPackagesVersionsListRequest
        .ViewValueValuesEnum.FULL)

  ver_list = []
  try:
    ver_list = ar_requests.ListVersions(client, messages,
                                        docker_img.GetPackageName(), ver_view,
                                        page_size, order_by, limit)

  except api_exceptions.HttpNotFoundError:
    # If there's no result, the package name might be part of a nested package.
    # E.g. us-west1-docker.pkg.dev/fake-project/docker-repo/nested1 in
    # us-west1-docker.pkg.dev/fake-project/docker-repo/nested1/nested2/test-image
    # Try to get the list of versions through the list of all packages.
    if search_subdirs:
      return _GetDockerPackagesAndVersions(
          docker_img.docker_repo,
          include_tags,
          page_size,
          order_by,
          limit,
          package_prefix=docker_img.GetDockerString() + "/")
    else:
      return []

  img_list = []
  for ver in ver_list:
    v = resources.REGISTRY.Parse(
        ver.name, collection=_VERSION_COLLECTION_NAME).Name()
    img = {
        "package": docker_img.GetDockerString(),
        "tags": [t.name.split("/")[-1] for t in ver.relatedTags],
        "version": v,
        "createTime": ver.createTime,
        "updateTime": ver.updateTime,
    }
    if ver.metadata is not None:
      img["metadata"] = {
          prop.key: prop.value.string_value
          for prop in ver.metadata.additionalProperties
      }
    img_list.append(img)
  return img_list


def _LogResourcesToDelete(docker_version, docker_tags):
  """Logs user visible messages on resources to be deleted."""
  log.status.Print("Digests:\n- " + docker_version.GetDockerString())
  if docker_tags:
    log.status.Print("\nTags:")
    for tag in docker_tags:
      log.status.Print("- " + tag.GetDockerString())


def _GetDockerVersionTags(client, messages, docker_version):
  """Gets a list of DockerTag associated with the given DockerVersion."""
  tags = ar_requests.ListVersionTags(client, messages,
                                     docker_version.GetPackageName(),
                                     docker_version.GetVersionName())
  return [
      DockerTag(docker_version.image,
                tag.name.split("/")[-1]) for tag in tags
  ]


def _ValidateDockerRepo(repo_name):
  repo = ar_requests.GetRepository(repo_name)
  messages = ar_requests.GetMessages()
  if repo.format != messages.Repository.FormatValueValuesEnum.DOCKER:
    raise ar_exceptions.InvalidInputValueError(
        "Invalid repository type {}. The `artifacts docker` command group can "
        "only be used on Docker repositories.".format(repo.format))


def _ValidateAndGetDockerVersion(version_or_tag):
  """Validates a version_or_tag and returns the validated DockerVersion object.

  Args:
    version_or_tag: a docker version or a docker tag.

  Returns:
    a DockerVersion object.

  Raises:
    ar_exceptions.InvalidInputValueError if version_or_tag is not valid.
  """
  try:
    if isinstance(version_or_tag, DockerVersion):
      # We have all the information about the docker digest.
      # Call the API to make sure it exists.
      ar_requests.GetVersion(ar_requests.GetClient(), ar_requests.GetMessages(),
                             version_or_tag.GetVersionName())
      return version_or_tag
    elif isinstance(version_or_tag, DockerTag):
      digest = ar_requests.GetVersionFromTag(ar_requests.GetClient(),
                                             ar_requests.GetMessages(),
                                             version_or_tag.GetTagName())
      docker_version = DockerVersion(version_or_tag.image, digest)
      return docker_version
    else:
      raise ar_exceptions.InvalidInputValueError(_INVALID_DOCKER_IMAGE_ERROR)
  except api_exceptions.HttpNotFoundError:
    raise ar_exceptions.InvalidInputValueError(_DOCKER_IMAGE_NOT_FOUND)


class DockerRepo(object):
  """Holder for a Docker repository.

  A valid Docker repository has the format of
  LOCATION-docker.DOMAIN/PROJECT-ID/REPOSITORY-ID

  Properties:
    project: str, The name of cloud project.
    location: str, The location of the Docker resource.
    repo: str, The name of the repository.
  """

  def __init__(self, project_id, location_id, repo_id):
    self._project = project_id
    self._location = location_id
    self._repo = repo_id

  @property
  def project(self):
    return self._project

  @property
  def location(self):
    return self._location

  @property
  def repo(self):
    return self._repo

  def __eq__(self, other):
    if isinstance(other, DockerRepo):
      return (
          self._project == other._project
          and self._location == other._location
          and self._repo == other._repo
      )
    return NotImplemented

  def GetDockerString(self):
    return "{}-docker.{}/{}/{}".format(
        self.location,
        properties.VALUES.artifacts.domain.Get(),
        self.project,
        self.repo,
    )

  def GetRepositoryName(self):
    loc = RemoveEndpointPrefix(self.location)
    return "projects/{}/locations/{}/repositories/{}".format(
        self.project, loc, self.repo
    )


class DockerImage(object):
  """Holder for a Docker image resource.

  A valid image has the format of
  LOCATION-docker.DOMAIN/PROJECT-ID/REPOSITORY-ID/IMAGE_PATH

  Properties:
    project: str, The name of cloud project.
    docker_repo: DockerRepo, The Docker repository.
    pkg: str, The name of the package.
  """

  def __init__(self, docker_repo, pkg_id):
    self._docker_repo = docker_repo
    self._pkg = pkg_id

  @property
  def project(self):
    return self._docker_repo.project

  @property
  def docker_repo(self):
    return self._docker_repo

  @property
  def pkg(self):
    return self._pkg

  def __eq__(self, other):
    if isinstance(other, DockerImage):
      return self._docker_repo == other._docker_repo and self._pkg == other._pkg
    return NotImplemented

  def GetPackageName(self):
    return "{}/packages/{}".format(self.docker_repo.GetRepositoryName(),
                                   self.pkg.replace("/", "%2F"))

  def GetDockerString(self):
    return "{}{}-docker.{}/{}/{}/{}".format(
        properties.VALUES.artifacts.registry_endpoint_prefix.Get(),
        self.docker_repo.location,
        properties.VALUES.artifacts.domain.Get(),
        self.docker_repo.project,
        self.docker_repo.repo,
        self.pkg.replace("%2F", "/"),
    )


class DockerTag(object):
  """Holder for a Docker tag.

  A valid Docker tag has the format of
  LOCATION-docker.DOMAIN/PROJECT-ID/REPOSITORY-ID/IMAGE:tag

  Properties:
    image: DockerImage, The DockerImage containing the tag.
    tag: str, The name of the Docker tag.
  """

  def __init__(self, docker_img, tag_id):
    self._image = docker_img
    self._tag = tag_id

  @property
  def image(self):
    return self._image

  @property
  def tag(self):
    return self._tag

  def __eq__(self, other):
    if isinstance(other, DockerTag):
      return self._image == other._image and self._tag == other._tag
    return NotImplemented

  def GetTagName(self):
    return "{}/tags/{}".format(self.image.GetPackageName(), self.tag)

  def GetPackageName(self):
    return self.image.GetPackageName()

  def GetDockerString(self):
    return "{}:{}".format(self.image.GetDockerString(), self.tag)


class DockerVersion(object):
  """Holder for a Docker version.

  A valid Docker version has the format of
  LOCATION-docker.DOMAIN/PROJECT-ID/REPOSITORY-ID/IMAGE@sha256:digest

  Properties:
    image: DockerImage, The DockerImage containing the tag.
    digest: str, The name of the Docker digest.
    project: str, the project this image belongs to.
  """

  def __init__(self, docker_img, digest):
    self._image = docker_img
    self._digest = digest

  @property
  def image(self):
    return self._image

  @property
  def digest(self):
    return self._digest

  @property
  def project(self):
    return self._image.docker_repo.project

  def __eq__(self, other):
    if isinstance(other, DockerVersion):
      return self._image == other._image and self._digest == other._digest
    return NotImplemented

  def GetVersionName(self):
    return "{}/versions/{}".format(self.image.GetPackageName(), self.digest)

  def GetPackageName(self):
    return self.image.GetPackageName()

  def GetDockerString(self):
    return "{}@{}".format(self.image.GetDockerString(), self.digest)


def GetDockerImages(resource, args):
  """Gets Docker images."""
  limit = args.limit
  # If filter is set, we leave limiting to gcloud SDK.
  if args.filter is not None:
    limit = None

  order_by = common_args.ParseSortByArg(args.sort_by)

  # Multi-ordering is not supported yet on backend.
  if order_by is not None:
    if "," in order_by:
      order_by = None
      limit = None

  if isinstance(resource, DockerRepo):
    _ValidateDockerRepo(resource.GetRepositoryName())
    log.status.Print(
        "Listing items under project {}, location {}, repository {}.\n".format(
            resource.project, resource.location, resource.repo
        )
    )

    # Docker util predates avaliblity of ListDockerImages API, thus doesn't
    # use DockerImage resource. Converting to legacy shape is requrired to
    # prevent breaking change.
    return [
        DockerImageToLegacy(img, args.include_tags)
        for img in ar_requests.ListDockerImages(
            resource.GetRepositoryName(), args.page_size, limit
        )
    ]
  elif isinstance(resource, DockerImage):
    _ValidateDockerRepo(resource.docker_repo.GetRepositoryName())
    log.status.Print(
        "Listing items under project {}, location {}, repository {}.\n".format(
            resource.docker_repo.project,
            resource.docker_repo.location,
            resource.docker_repo.repo,
        )
    )
    return _GetDockerVersions(
        resource,
        args.include_tags,
        args.page_size,
        order_by,
        limit,
        search_subdirs=True,
    )
  return []


def DockerImageToLegacy(img, include_tags: bool) -> map:
  """Converts a docker image resource from generated client into legacy format.

  Args:
    img: The docker image to convert to legacy format
    include_tags: Bool to specify if tags should be included

  Returns:
    Legacy representation of a docker image.
  """
  splits = img.uri.split("@")
  if len(splits) != 2:
    raise ar_exceptions.ArtifactRegistryError(
        "Unable to parse docker image URI: {}".format(img.uri)
    )

  return {
      # Package is URI without the version.
      "package": splits[0],
      "version": splits[1],
      "createTime": img.uploadTime,
      "updateTime": img.updateTime,
      "metadata": {
          "buildTime": img.buildTime,
          "mediaType": img.mediaType,
          # Legacy format uses a string here instead of a int.
          "imageSizeBytes": str(img.imageSizeBytes),
          "name": img.name,
      },
      # Historically tags were not queried from backend by default. Now tags
      # are always included, but to prevent breaking change only include if
      # requested.
      "tags": img.tags if include_tags else "",
  }


def WaitForOperation(operation, message):
  """Waits for the given google.longrunning.Operation to complete.

  Args:
    operation: The operation to poll.
    message: String to display for default progress_tracker.

  Raises:
    apitools.base.py.HttpError: if the request returns an HTTP error
  """
  op_service = ar_requests.GetClient().projects_locations_operations
  op_resource = resources.REGISTRY.ParseRelativeName(
      operation.name,
      collection="artifactregistry.projects.locations.operations")
  poller = waiter.CloudOperationPollerNoResources(op_service)
  waiter.WaitFor(poller, op_resource, message)


class GcrDockerVersion:
  """Class for sending a gcr.io docker url to container analysis.

  Attributes:
    project:
    docker_string:
  """

  @property
  def project(self):
    return self._project

  def __init__(self, project, docker_string):
    self._project = project
    self._docker_string = docker_string

  def GetDockerString(self):
    return self._docker_string


def ConvertGCRImageString(image_string):
  """Converts GCR image string to AR format. Leaves non-GCR strings as-is."""
  location_map = {
      "us.gcr.io": "us",
      "gcr.io": "us",
      "eu.gcr.io": "europe",
      "asia.gcr.io": "asia",
  }

  matches = re.match(GCR_DOCKER_REPO_REGEX, image_string)
  if matches:
    return (
        "{}-docker.pkg.dev/{}/{}/{}".format(
            location_map[matches.group("repo")],
            matches.group("project"),
            matches.group("repo"),
            matches.group("image"),
        ),
        matches.group("project"),
        True,
    )
  matches = re.match(GCR_DOCKER_DOMAIN_SCOPED_REPO_REGEX, image_string)
  if matches:
    return (
        "{}-docker.pkg.dev/{}/{}/{}".format(
            location_map[matches.group("repo")],
            matches.group("project"),
            matches.group("repo"),
            matches.group("image"),
        ),
        matches.group("project"),
        True,
    )
  return image_string, None, False


def DescribeDockerImage(args):
  """Retrieves information about a docker image based on the fully-qualified name.

  Args:
    args: user input arguments.

  Returns:
    A dictionary of information about the given docker image.
  """
  ar_image_name, gcr_project, in_gcr_format = ConvertGCRImageString(args.IMAGE)
  if in_gcr_format:
    messages = ar_requests.GetMessages()
    settings = ar_requests.GetProjectSettings(gcr_project)
    if (
        settings.legacyRedirectionState
        != messages.ProjectSettings.LegacyRedirectionStateValueValuesEnum.REDIRECTION_FROM_GCR_IO_ENABLED
    ):
      raise ar_exceptions.InvalidInputValueError(
          "This command only supports Artifact Registry. You can enable"
          " redirection to use gcr.io repositories in Artifact Registry."
      )
  image, docker_version = DockerUrlToVersion(ar_image_name)

  scanning_allowed = True
  # This is the version to send to scanning API. For pkg.dev versions, it is the
  # same, but for gcr.io versions, use the gcr.io url.
  scanning_docker_version = docker_version
  if "gcr.io" in image.docker_repo.repo:
    if not in_gcr_format:
      messages = ar_requests.GetMessages()
      settings = ar_requests.GetProjectSettings(image.docker_repo.project)
      if (
          settings.legacyRedirectionState
          != messages.ProjectSettings.LegacyRedirectionStateValueValuesEnum.REDIRECTION_FROM_GCR_IO_ENABLED
      ):
        log.warning(
            "gcr.io domain repos in Artifact Registry are not scanned unless "
            "they are redirected"
        )
        scanning_allowed = False
      else:
        log.info(
            "Note: The container scanning API uses the gcr.io url for"
            " gcr.io domain repos"
        )

    scanning_docker_version = GcrDockerVersion(
        image.docker_repo.project,
        docker_version.GetDockerString().replace(
            image.docker_repo.GetDockerString(),
            "{}/{}".format(
                image.docker_repo.repo,  # AR repo name is the gcr_host
                image.docker_repo.project,
            ),
        ),
    )
  result = {}
  result["image_summary"] = {
      "digest": docker_version.digest,
      "fully_qualified_digest": docker_version.GetDockerString(),
      "registry": "{}-docker.{}".format(
          docker_version.image.docker_repo.location,
          properties.VALUES.artifacts.domain.Get(),
      ),
      "repository": docker_version.image.docker_repo.repo,
  }
  if scanning_allowed:
    summary_metadata = ca_util.GetImageSummaryMetadata(scanning_docker_version)
    result["image_summary"][
        "slsa_build_level"
    ] = summary_metadata.SLSABuildLevel()
    # Get SBOM references, and if it's not empty, add SBOM file locations to
    # "image_summary".
    sbom_locations = summary_metadata.SbomLocations()
    if sbom_locations:
      result["image_summary"]["sbom_locations"] = sbom_locations

    metadata = ca_util.GetContainerAnalysisMetadata(
        scanning_docker_version, args
    )
    result.update(metadata.ArtifactsDescribeView())
  return result


def DeleteDockerImage(args):
  """Deletes a Docker digest or image.

  If input is an image, delete the image along with its resources.

  If input is an image identified by digest, delete the digest.
  If input is an image identified by tag, delete the digest and the tag.
  If --delete-tags is specified, delete all tags associated with the image
  digest.

  Args:
    args: user input arguments.

  Returns:
    The long-running operation from DeletePackage API call.
  """
  image, version_or_tag = _ParseDockerImage(args.IMAGE, _INVALID_IMAGE_ERROR)
  _ValidateDockerRepo(image.docker_repo.GetRepositoryName())
  client = ar_requests.GetClient()
  messages = ar_requests.GetMessages()
  if not version_or_tag:
    console_io.PromptContinue(
        message="\nThis operation will delete all tags and images for " +
        image.GetDockerString() + ".",
        cancel_on_no=True)
    return ar_requests.DeletePackage(client, messages, image.GetPackageName())

  else:
    provided_tags = []
    docker_version = version_or_tag
    if isinstance(version_or_tag, DockerTag):
      docker_version = DockerVersion(
          version_or_tag.image,
          ar_requests.GetVersionFromTag(client, messages,
                                        version_or_tag.GetTagName()))
      provided_tags.append(version_or_tag)
    existing_tags = _GetDockerVersionTags(client, messages, docker_version)

    if not args.delete_tags and existing_tags != provided_tags:
      raise ar_exceptions.ArtifactRegistryError(
          "Cannot delete image {} because it is tagged. "
          "Existing tags are:\n- {}".format(
              args.IMAGE,
              "\n- ".join(tag.GetDockerString() for tag in existing_tags)))

    _LogResourcesToDelete(docker_version, existing_tags)
    console_io.PromptContinue(
        message="\nThis operation will delete the above resources.",
        cancel_on_no=True)

    for tag in existing_tags:
      ar_requests.DeleteTag(client, messages, tag.GetTagName())
    return ar_requests.DeleteVersion(client, messages,
                                     docker_version.GetVersionName())


def GetDockerImage(image_url):
  """Gets a Docker image.

  Args:
    image_url (str): path to a Docker image.

  Returns:
    package: Docker image package

  Throws:
    HttpNotFoundError: if repo or image path are invalid
  """
  image, _ = _ParseDockerImage(image_url, _INVALID_IMAGE_ERROR)
  _ValidateDockerRepo(image.docker_repo.GetRepositoryName())
  return ar_requests.GetPackage(image.GetPackageName())


def AddDockerTag(args):
  """Adds a Docker tag."""
  src_image, version_or_tag = _ParseDockerImage(args.DOCKER_IMAGE,
                                                _INVALID_DOCKER_IMAGE_ERROR)
  if version_or_tag is None:
    raise ar_exceptions.InvalidInputValueError(_INVALID_DOCKER_IMAGE_ERROR)

  dest_image, tag = _ParseDockerTag(args.DOCKER_TAG)

  if src_image.GetPackageName() != dest_image.GetPackageName():
    raise ar_exceptions.InvalidInputValueError(
        "Image {}\ndoes not match image {}".format(
            src_image.GetDockerString(), dest_image.GetDockerString()))

  _ValidateDockerRepo(src_image.docker_repo.GetRepositoryName())

  client = ar_requests.GetClient()
  messages = ar_requests.GetMessages()
  docker_version = version_or_tag
  if isinstance(version_or_tag, DockerTag):
    docker_version = DockerVersion(
        version_or_tag.image,
        ar_requests.GetVersionFromTag(client, messages,
                                      version_or_tag.GetTagName()))

  try:
    ar_requests.GetTag(client, messages, tag.GetTagName())
  except api_exceptions.HttpNotFoundError:
    ar_requests.CreateDockerTag(client, messages, tag, docker_version)
  else:
    ar_requests.DeleteTag(client, messages, tag.GetTagName())
    ar_requests.CreateDockerTag(client, messages, tag, docker_version)

  log.status.Print("Added tag [{}] to image [{}].".format(
      tag.GetDockerString(), args.DOCKER_IMAGE))


def DeleteDockerTag(args):
  """Deletes a Docker tag."""
  img, tag = _ParseDockerTag(args.DOCKER_TAG)
  _ValidateDockerRepo(img.docker_repo.GetRepositoryName())

  console_io.PromptContinue(
      message="You are about to delete tag [{}]".format(tag.GetDockerString()),
      cancel_on_no=True)
  ar_requests.DeleteTag(ar_requests.GetClient(), ar_requests.GetMessages(),
                        tag.GetTagName())
  log.status.Print("Deleted tag [{}].".format(tag.GetDockerString()))


def ListDockerTags(args):
  """Lists Docker tags."""
  resource = ParseDockerImagePath(args.IMAGE_PATH)

  client = ar_requests.GetClient()
  messages = ar_requests.GetMessages()
  img_list = []
  if isinstance(resource, DockerRepo):
    _ValidateDockerRepo(resource.GetRepositoryName())
    log.status.Print(
        "Listing items under project {}, location {}, repository {}.\n".format(
            resource.project, resource.location, resource.repo))
    for pkg in ar_requests.ListPackages(client, messages,
                                        resource.GetRepositoryName()):
      img_list.append(DockerImage(resource, pkg.name.split("/")[-1]))
  elif isinstance(resource, DockerImage):
    _ValidateDockerRepo(resource.docker_repo.GetRepositoryName())
    log.status.Print(
        "Listing items under project {}, location {}, repository {}.\n".format(
            resource.docker_repo.project, resource.docker_repo.location,
            resource.docker_repo.repo))
    img_list.append(resource)

  tag_list = []
  for img in img_list:
    for tag in ar_requests.ListTags(client, messages, img.GetPackageName(),
                                    args.page_size):
      tag_list.append({
          "tag": tag.name,
          "image": img.GetDockerString(),
          "version": tag.version,
      })
  return tag_list


def DockerUrlToVersion(url):
  """Validates a Docker image URL and get Docker version information.

  Args:
    url: Url of a docker image.

  Returns:
    A DockerImage, and a DockerVersion.

  Raises:
    ar_exceptions.InvalidInputValueError: If user input is invalid.

  """
  image, version_or_tag = _ParseDockerImage(
      url, _INVALID_IMAGE_ERROR, strict=False
  )
  _ValidateDockerRepo(image.docker_repo.GetRepositoryName())
  docker_version = _ValidateAndGetDockerVersion(version_or_tag)
  return image, docker_version


def DockerUrlToImage(url):
  """Converts docker url to image.

  If a version or tag is present, validate it, transform tags to versions, and
  return it.  Otherwise, none will be returned in place of version.  This
  function is similar to DockerUrlToVersion with some differences like strict
  parsing and only validating if version or tag is none.

  Args:
    url: Url of a docker image, which could have version or tag.

  Returns:
    A DockerImage, and a DockerVersion.  DockerVersion can be None.

  Raises:
    ar_exceptions.InvalidInputValueError: If user input is invalid.
  """
  image, version_or_tag = _ParseDockerImage(
      url, _INVALID_IMAGE_ERROR, strict=True
  )
  _ValidateDockerRepo(image.docker_repo.GetRepositoryName())
  if version_or_tag is None:
    return image, None
  docker_version = _ValidateAndGetDockerVersion(version_or_tag)
  return image, docker_version


def IsARDockerImage(uri):
  return re.match(DOCKER_REPO_REGEX, uri) is not None


def IsGCRImage(uri):
  return (
      re.match(GCR_DOCKER_REPO_REGEX, uri) is not None
      or re.match(GCR_DOCKER_DOMAIN_SCOPED_REPO_REGEX, uri) is not None
  )


def RemoveEndpointPrefix(location):
  endpoint_prefix = properties.VALUES.artifacts.registry_endpoint_prefix.Get()
  return (
      location[len(endpoint_prefix) :]
      if location.startswith(endpoint_prefix)
      else location
  )
